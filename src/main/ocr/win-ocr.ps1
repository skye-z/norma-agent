Add-Type -AssemblyName System.Runtime
Add-Type -AssemblyName System.Runtime.InteropServices
Add-Type -AssemblyName System.Threading

$code = @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading.Tasks;
using System.Linq;

public class WinOcrBridge
{
    [StructLayout(LayoutKind.Sequential)]
    public struct Rect
    {
        public double X;
        public double Y;
        public double Width;
        public double Height;
    }

    public class TextMatch
    {
        public string Text;
        public double X;
        public double Y;
        public double Confidence;
        public TextBounds Bounds;
    }

    public class TextBounds
    {
        public double X;
        public double Y;
        public double Width;
        public double Height;
    }

    public class OCRResult
    {
        public bool Success;
        public List<TextMatch> Matches;
        public string Error;
    }

    public static OCRResult RunOcr(string pngPath, double scale)
    {
        var result = new OCRResult { Success = false, Matches = new List<TextMatch>(), Error = null };

        try
        {
            var bytes = File.ReadAllBytes(pngPath);

            // Use reflection to load WinRT types
            var ocrEngineType = Type.GetType("Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime");
            if (ocrEngineType == null)
            {
                result.Error = "Windows.Media.Ocr not available (requires Windows 10 1903+)";
                return result;
            }

            var tryCreateMethod = ocrEngineType.GetMethod("TryCreateFromUserProfileLanguages");
            var engine = tryCreateMethod?.Invoke(null, null);
            if (engine == null)
            {
                result.Error = "Failed to create OcrEngine";
                return result;
            }

            // Load PNG into SoftwareBitmap
            var bitmap = LoadPngToSoftwareBitmap(bytes);
            if (bitmap == null)
            {
                result.Error = "Failed to load PNG into SoftwareBitmap";
                return result;
            }

            // Call RecognizeAsync
            var recognizeAsyncMethod = ocrEngineType.GetMethod("RecognizeAsync");
            var asyncInfo = recognizeAsyncMethod?.Invoke(engine, new object[] { bitmap });
            if (asyncInfo == null)
            {
                result.Error = "RecognizeAsync returned null";
                return result;
            }

            // Wait for async result
            var ocrResult = WaitForAsync(asyncInfo);
            if (ocrResult == null)
            {
                result.Error = "OCR async operation failed";
                return result;
            }

            // Extract Lines → Words
            var linesProperty = ocrResult.GetType().GetProperty("Lines");
            var lines = linesProperty?.GetValue(ocrResult) as System.Collections.Generic.IEnumerable<object>;
            if (lines == null)
            {
                result.Error = "Failed to get OCR lines";
                return result;
            }

            foreach (var line in lines)
            {
                var wordsProperty = line.GetType().GetProperty("Words");
                var words = wordsProperty?.GetValue(line) as System.Collections.Generic.IEnumerable<object>;
                if (words == null) continue;

                foreach (var word in words)
                {
                    var textProp = word.GetType().GetProperty("Text");
                    var rectProp = word.GetType().GetProperty("BoundingRect");

                    var text = textProp?.GetValue(word)?.ToString() ?? "";
                    var rectObj = rectProp?.GetValue(word);

                    if (rectObj == null) continue;

                    var rectType = rectObj.GetType();
                    var x = (double)rectType.GetProperty("X")!.GetValue(rectObj)!;
                    var y = (double)rectType.GetProperty("Y")!.GetValue(rectObj)!;
                    var w = (double)rectType.GetProperty("Width")!.GetValue(rectObj)!;
                    var h = (double)rectType.GetProperty("Height")!.GetValue(rectObj)!;

                    var bounds = new TextBounds
                    {
                        X = x / scale,
                        Y = y / scale,
                        Width = w / scale,
                        Height = h / scale
                    };

                    result.Matches.Add(new TextMatch
                    {
                        Text = text,
                        X = bounds.X + bounds.Width / 2.0,
                        Y = bounds.Y + bounds.Height / 2.0,
                        Confidence = 1.0,
                        Bounds = bounds
                    });
                }
            }

            result.Success = true;
        }
        catch (Exception ex)
        {
            result.Error = ex.Message;
        }

        return result;
    }

    private static object LoadPngToSoftwareBitmap(byte[] pngData)
    {
        try
        {
            var randomAccessType = Type.GetType("Windows.Storage.Streams.InMemoryRandomAccessStream, Windows.Storage.Streams, ContentType=WindowsRuntime");
            if (randomAccessType == null) return null;

            var stream = Activator.CreateInstance(randomAccessType);

            // Write bytes to stream
            var dataWriterType = Type.GetType("Windows.Storage.Streams.DataWriter, Windows.Storage.Streams, ContentType=WindowsRuntime");
            if (dataWriterType == null) return null;

            var createMethod = dataWriterType.GetMethod("CreateDataWriter", new[] { randomAccessType.GetInterfaces().First(i => i.Name == "IRandomAccessStream") });
            if (createMethod == null) return null;

            var streamInterface = randomAccessType.GetInterfaces().First(i => i.Name == "IRandomAccessStream");
            var writer = createMethod.Invoke(null, new object[] { stream });

            var writeBytesMethod = dataWriterType.GetMethod("WriteBytes", new[] { typeof(byte[]) });
            writeBytesMethod?.Invoke(writer, new object[] { pngData });

            var storeAsyncMethod = dataWriterType.GetMethod("StoreAsync");
            var storeAsync = storeAsyncMethod?.Invoke(writer, null);
            WaitForAsync(storeAsync);

            var flushAsyncMethod = dataWriterType.GetMethod("FlushAsync");
            var flushAsync = flushAsyncMethod?.Invoke(writer, null);
            WaitForAsync(flushAsync);

            var detachMethod = dataWriterType.GetMethod("DetachStream");
            detachMethod?.Invoke(writer, null);

            // Seek to beginning
            var seekMethod = randomAccessType.GetMethod("Seek");
            seekMethod?.Invoke(stream, new object[] { (ulong)0 });

            // Create BitmapDecoder
            var decoderType = Type.GetType("Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime");
            if (decoderType == null) return null;

            var createAsyncMethod = decoderType.GetMethod("CreateAsync", new[] { streamInterface });
            var decoderAsync = createAsyncMethod?.Invoke(null, new object[] { stream });
            var decoder = WaitForAsync(decoderAsync);

            // Get SoftwareBitmap
            var getBitmapMethod = decoderType.GetMethod("GetSoftwareBitmapAsync");
            var bitmapAsync = getBitmapMethod?.Invoke(decoder, null);
            return WaitForAsync(bitmapAsync);
        }
        catch
        {
            return null;
        }
    }

    private static object WaitForAsync(object asyncInfo)
    {
        if (asyncInfo == null) return null;

        try
        {
            // Try IAsyncOperation pattern
            var asyncResultType = asyncInfo.GetType();
            var getResultsMethod = asyncResultType.GetMethod("GetResults");

            // Try to check status first
            var statusProperty = asyncResultType.GetProperty("Status");
            if (statusProperty != null)
            {
                var status = statusProperty.GetValue(asyncInfo);
                var statusValue = (int)status;

                // 0 = Started, 1 = Completed, 2 = Canceled, 3 = Error
                if (statusValue == 3)
                {
                    var errorCodeProperty = asyncResultType.GetProperty("ErrorCode");
                    var error = errorCodeProperty?.GetValue(asyncInfo);
                    return null;
                }

                if (statusValue == 1)
                {
                    return getResultsMethod?.Invoke(asyncInfo, null);
                }
            }

            // Wait using Task
            var asTaskExtensions = Type.GetType("System.WindowsRuntimeSystemExtensions");
            if (asTaskExtensions != null)
            {
                var asTaskMethod = asTaskExtensions.GetMethods()
                    .FirstOrDefault(m => m.Name == "AsTask" && m.GetParameters().Length == 1);

                if (asTaskMethod != null)
                {
                    var genericMethod = asTaskMethod.MakeGenericMethod(asyncResultType);
                    var task = genericMethod.Invoke(null, new object[] { asyncInfo });

                    var taskType = task.GetType();
                    var resultProperty = taskType.GetProperty("Result");
                    return resultProperty?.GetValue(task);
                }
            }

            // Fallback: just try GetResults
            return getResultsMethod?.Invoke(asyncInfo, null);
        }
        catch
        {
            return null;
        }
    }
}
"@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies @("System.Runtime", "System.Runtime.InteropServices", "System.Threading")
} catch {
    $errorResult = @{ success = $false; matches = @(); error = "Failed to compile WinRT bridge: $_" }
    $errorResult | ConvertTo-Json -Compress
    exit 1
}

$pngPath = $args[0]
$scale = if ($args.Length -gt 1) { [double]$args[1] } else { 1.0 }

if (-not (Test-Path $pngPath)) {
    $errorResult = @{ success = $false; matches = @(); error = "PNG file not found: $pngPath" }
    $errorResult | ConvertTo-Json -Compress
    exit 1
}

$result = [WinOcrBridge]::RunOcr($pngPath, $scale)

$output = @{
    success = $result.Success
    matches = $result.Matches | ForEach-Object {
        @{
            text = $_.Text
            x = [math]::Round($_.X, 2)
            y = [math]::Round($_.Y, 2)
            confidence = $_.Confidence
            bounds = @{
                x = [math]::Round($_.Bounds.X, 2)
                y = [math]::Round($_.Bounds.Y, 2)
                width = [math]::Round($_.Bounds.Width, 2)
                height = [math]::Round($_.Bounds.Height, 2)
            }
        }
    }
    error = $result.Error
}

$output | ConvertTo-Json -Compress -Depth 5
