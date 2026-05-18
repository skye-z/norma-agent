using System;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Reflection;

namespace WinOcr
{
    class Program
    {
        static MethodInfo _asTask;
        static MethodInfo _asTaskAction;

        static void Main(string[] args)
        {
            if (args.Length < 1)
            {
                Console.Error.WriteLine("Usage: norma-ocr-win <png_path> [scale]");
                Environment.Exit(1);
                return;
            }

            string pngPath = args[0];
            double scale = args.Length > 1 ? double.Parse(args[1]) : 1.0;

            try
            {
                var winrt = Assembly.Load("System.Runtime.WindowsRuntime, Version=4.0.0.0, Culture=neutral, PublicKeyToken=b77a5c561934e089");
                var extType = winrt.GetType("System.WindowsRuntimeSystemExtensions");

                foreach (var m in extType.GetMethods(BindingFlags.Public | BindingFlags.Static))
                {
                    if (m.Name != "AsTask" || !m.IsGenericMethod) continue;
                    var ps = m.GetParameters();
                    if (ps.Length != 1) continue;
                    var pn = ps[0].ParameterType.Name;
                    if (pn.StartsWith("IAsyncOperation`1")) _asTask = m;
                    if (pn == "IAsyncAction") _asTaskAction = m;
                }

                if (!File.Exists(pngPath))
                {
                    WriteResult(false, "File not found: " + pngPath);
                    Environment.Exit(1);
                    return;
                }

                Type storageFileType = Type.GetType("Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime");
                Type decoderType = Type.GetType("Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime");
                Type engineType = Type.GetType("Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime");
                Type bitmapType = Type.GetType("Windows.Graphics.Imaging.SoftwareBitmap,Windows.Graphics.Imaging,ContentType=WindowsRuntime");
                Type ocrResultType = Type.GetType("Windows.Media.Ocr.OcrResult,Windows.Media.Ocr,ContentType=WindowsRuntime");

                MethodInfo getFileMethod = FindMethod(storageFileType, "GetFileFromPathAsync", 1);
                dynamic fileAsync = getFileMethod.Invoke(null, new object[] { pngPath });
                dynamic file = AwaitTyped(fileAsync, storageFileType);

                MethodInfo openMethod = FindMethod(file.GetType(), "OpenAsync", 1);
                dynamic streamAsync = openMethod.Invoke(file, new object[] { 0 });
                var irasType = Type.GetType("Windows.Storage.Streams.IRandomAccessStream,Windows.Storage,ContentType=WindowsRuntime");
                dynamic stream = AwaitTyped(streamAsync, irasType);

                MethodInfo createMethod = FindMethod(decoderType, "CreateAsync", 1);
                dynamic decoderAsync = createMethod.Invoke(null, new object[] { stream });
                dynamic decoder = AwaitTyped(decoderAsync, decoderType);

                MethodInfo bitmapMethod = FindMethod(decoder.GetType(), "GetSoftwareBitmapAsync", 0);
                dynamic bitmapAsync = bitmapMethod.Invoke(decoder, null);
                dynamic bitmap = AwaitTyped(bitmapAsync, bitmapType);

                MethodInfo tryCreateMethod = FindMethod(engineType, "TryCreateFromUserProfileLanguages", 0);
                dynamic engine = tryCreateMethod.Invoke(null, null);
                if (engine == null) { WriteResult(false, "OcrEngine not available"); Environment.Exit(1); return; }

                MethodInfo recognizeMethod = FindMethod(engine.GetType(), "RecognizeAsync", 1);
                dynamic resultAsync = recognizeMethod.Invoke(engine, new object[] { bitmap });
                dynamic result = AwaitTyped(resultAsync, ocrResultType);

                var sb = new StringBuilder();
                sb.Append("{\"success\":true,\"matches\":[");
                bool first = true;

                foreach (var line in result.Lines)
                {
                    foreach (var word in line.Words)
                    {
                        var r = word.BoundingRect;
                        double bx = Math.Round((double)r.X / scale, 2);
                        double by = Math.Round((double)r.Y / scale, 2);
                        double bw = Math.Round((double)r.Width / scale, 2);
                        double bh = Math.Round((double)r.Height / scale, 2);
                        double cx = Math.Round(bx + bw / 2.0, 2);
                        double cy = Math.Round(by + bh / 2.0, 2);

                        if (!first) sb.Append(",");
                        first = false;
                        sb.Append("{\"text\":");
                        sb.Append(EscapeJson((string)word.Text));
                        sb.Append(",\"x\":");
                        sb.Append(cx.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"y\":");
                        sb.Append(cy.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"confidence\":1.0,\"bounds\":{\"x\":");
                        sb.Append(bx.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"y\":");
                        sb.Append(by.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"width\":");
                        sb.Append(bw.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append(",\"height\":");
                        sb.Append(bh.ToString(System.Globalization.CultureInfo.InvariantCulture));
                        sb.Append("}}");
                    }
                }

                sb.Append("],\"error\":null}");
                Console.WriteLine(sb.ToString());
            }
            catch (Exception ex)
            {
                WriteResult(false, ex.ToString());
                Environment.Exit(1);
            }
        }

        static MethodInfo FindMethod(Type type, string name, int paramCount)
        {
            foreach (var m in type.GetMethods(BindingFlags.Public | BindingFlags.Instance | BindingFlags.Static))
            {
                if (m.Name == name && m.GetParameters().Length == paramCount) return m;
            }
            return null;
        }

        static object AwaitTyped(object asyncOp, Type resultType)
        {
            if (_asTask != null && resultType != null)
            {
                var concrete = _asTask.MakeGenericMethod(resultType);
                var task = (Task)concrete.Invoke(null, new object[] { asyncOp });
                task.Wait();
                return task.GetType().GetProperty("Result").GetValue(task);
            }
            if (_asTaskAction != null)
            {
                var task = (Task)_asTaskAction.Invoke(null, new object[] { asyncOp });
                task.Wait();
                return null;
            }
            throw new Exception("No AsTask method found");
        }

        static string EscapeJson(string s)
        {
            if (s == null) return "null";
            var sb = new StringBuilder();
            sb.Append('"');
            foreach (char c in s)
            {
                if (c == '"') sb.Append("\\\"");
                else if (c == '\\') sb.Append("\\\\");
                else if (c == '\n') sb.Append("\\n");
                else if (c == '\r') sb.Append("\\r");
                else if (c == '\t') sb.Append("\\t");
                else sb.Append(c);
            }
            sb.Append('"');
            return sb.ToString();
        }

        static void WriteResult(bool success, string error)
        {
            string err = error != null ? EscapeJson(error) : "null";
            Console.WriteLine("{\"success\":" + success.ToString().ToLower() + ",\"matches\":[],\"error\":" + err + "}");
        }
    }
}
