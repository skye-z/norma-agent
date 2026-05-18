using System;
using System.Speech.Recognition;
using System.Threading;
using System.IO;

namespace WinSpeech
{
    class Program
    {
        static void Main(string[] args)
        {
            bool continuous = args.Length > 0 && args[0] == "--continuous";
            int timeoutSec = 30;

            if (args.Length > 0)
            {
                foreach (var a in args)
                {
                    if (a.StartsWith("--timeout="))
                        int.TryParse(a.Substring("--timeout=".Length), out timeoutSec);
                }
            }

            try
            {
                using (var engine = new SpeechRecognitionEngine())
                {
                    engine.LoadGrammar(new DictationGrammar());
                    engine.LoadGrammar(new DictationGrammar("grammar:dictation#spelling"));
                    engine.BabbleTimeout = TimeSpan.FromSeconds(timeoutSec);
                    engine.InitialSilenceTimeout = TimeSpan.FromSeconds(timeoutSec);
                    engine.EndSilenceTimeout = TimeSpan.FromSeconds(2);
                    engine.EndSilenceTimeoutAmbiguous = TimeSpan.FromSeconds(3);

                    engine.SetInputToDefaultAudioDevice();

                    bool done = false;
                    var resultText = "";
                    float resultConfidence = 0;

                    engine.SpeechRecognized += (sender, e) =>
                    {
                        if (e.Result != null)
                        {
                            resultText = e.Result.Text;
                            resultConfidence = e.Result.Confidence;

                            if (continuous)
                            {
                                Console.WriteLine("PARTIAL|" + resultConfidence.ToString("F2") + "|" + resultText);
                                Console.Out.Flush();
                            }
                        }
                    };

                    engine.SpeechRecognitionRejected += (sender, e) =>
                    {
                        if (!continuous)
                        {
                            done = true;
                        }
                    };

                    engine.RecognizeCompleted += (sender, e) =>
                    {
                        if (!continuous)
                        {
                            done = true;
                        }
                    };

                    if (continuous)
                    {
                        engine.RecognizeAsync(RecognizeMode.Multiple);

                        string line;
                        while ((line = Console.ReadLine()) != null)
                        {
                            if (line == "STOP") break;
                        }

                        engine.RecognizeAsyncCancel();

                        if (!string.IsNullOrEmpty(resultText))
                        {
                            WriteResult(true, resultConfidence, resultText);
                        }
                        else
                        {
                            WriteResult(false, 0, "No speech detected");
                        }
                    }
                    else
                    {
                        var result = engine.Recognize(TimeSpan.FromSeconds(timeoutSec));

                        if (result != null && !string.IsNullOrEmpty(result.Text))
                        {
                            WriteResult(true, result.Confidence, result.Text);
                        }
                        else
                        {
                            WriteResult(false, 0, "No speech detected within timeout");
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                WriteResult(false, 0, ex.Message);
            }
        }

        static void WriteResult(bool success, float confidence, string text)
        {
            var escaped = text.Replace("\\", "\\\\").Replace("\"", "\\\"").Replace("\n", "\\n").Replace("\r", "");
            Console.WriteLine("{\"success\":" + (success ? "true" : "false") + ",\"confidence\":" + confidence.ToString("F2") + ",\"text\":\"" + escaped + "\"}");
        }
    }
}
