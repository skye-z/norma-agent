param(
    [Parameter(Mandatory=$true)]
    [string]$PngPath,
    
    [double]$Scale = 1.0
)

Add-Type -AssemblyName System.Runtime

$code = @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

public class WinOcrResult
{
    public bool Success;
    public List<TextMatch> Matches;
    public string Error;
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
"@

try {
    Add-Type -TypeDefinition $code -Language CSharp -ReferencedAssemblies @("System.Runtime")
} catch {
    @{ success = $false; matches = @(); error = "Failed to compile types: $_" } | ConvertTo-Json -Compress
    exit 1
}

try {
    if (-not (Test-Path $PngPath)) {
        @{ success = $false; matches = @(); error = "PNG file not found: $PngPath" } | ConvertTo-Json -Compress
        exit 1
    }

    $null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
    $null = [Windows.Media.Ocr.OcrEngine, Windows.Media.Ocr, ContentType=WindowsRuntime]
    $null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
    $null = [Windows.Storage.Streams.RandomAccessStreamReference, Windows.Storage.Streams, ContentType=WindowsRuntime]

    $file = [System.IO.File]::OpenRead($PngPath)
    $memStream = New-Object System.IO.MemoryStream
    $file.CopyTo($memStream)
    $file.Close()
    $bytes = $memStream.ToArray()
    $memStream.Close()

    $inMemStream = New-Object System.IO.InMemoryRandomAccessStream
    $writer = New-Object System.IO.BinaryWriter($inMemStream)
    $writer.Write($bytes)
    $writer.Flush()
    $inMemStream.Seek(0, [System.IO.SeekOrigin]::Begin) | Out-Null

    $decoderTask = [Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($inMemStream) | 
        ForEach-Object { $_.AsTask().Result }
    if ($null -eq $decoderTask) {
        @{ success = $false; matches = @(); error = "Failed to create BitmapDecoder" } | ConvertTo-Json -Compress
        exit 1
    }

    $bitmap = $decoderTask.GetSoftwareBitmapAsync().AsTask().Result
    if ($null -eq $bitmap) {
        @{ success = $false; matches = @(); error = "Failed to get SoftwareBitmap" } | ConvertTo-Json -Compress
        exit 1
    }

    $ocrEngine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $ocrEngine) {
        @{ success = $false; matches = @(); error = "Failed to create OcrEngine" } | ConvertTo-Json -Compress
        exit 1
    }

    $ocrResult = $ocrEngine.RecognizeAsync($bitmap).AsTask().Result
    if ($null -eq $ocrResult) {
        @{ success = $false; matches = @(); error = "OCR returned null" } | ConvertTo-Json -Compress
        exit 1
    }

    $matches = New-Object System.Collections.Generic.List[TextMatch]

    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $bounds = New-Object TextBounds
            $bounds.X = [math]::Round($word.BoundingRect.X / $Scale, 2)
            $bounds.Y = [math]::Round($word.BoundingRect.Y / $Scale, 2)
            $bounds.Width = [math]::Round($word.BoundingRect.Width / $Scale, 2)
            $bounds.Height = [math]::Round($word.BoundingRect.Height / $Scale, 2)

            $match = New-Object TextMatch
            $match.Text = $word.Text
            $match.X = [math]::Round($bounds.X + $bounds.Width / 2.0, 2)
            $match.Y = [math]::Round($bounds.Y + $bounds.Height / 2.0, 2)
            $match.Confidence = 1.0
            $match.Bounds = $bounds
            $matches.Add($match)
        }
    }

    $result = New-Object WinOcrResult
    $result.Success = $true
    $result.Matches = $matches
    $result.Error = $null

    $output = @{
        success = $result.Success
        matches = $result.Matches | ForEach-Object {
            @{
                text = $_.Text
                x = $_.X
                y = $_.Y
                confidence = $_.Confidence
                bounds = @{
                    x = $_.Bounds.X
                    y = $_.Bounds.Y
                    width = $_.Bounds.Width
                    height = $_.Bounds.Height
                }
            }
        }
        error = $null
    }

    $output | ConvertTo-Json -Compress -Depth 5
} catch {
    @{ success = $false; matches = @(); error = "OCR error: $($_.Exception.Message)" } | ConvertTo-Json -Compress
    exit 1
}
