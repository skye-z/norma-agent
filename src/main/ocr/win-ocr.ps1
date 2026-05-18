param(
    [Parameter(Mandatory=$true)]
    [string]$PngPath,
    [double]$Scale = 1.0
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime

$null = [Windows.Media.Ocr.OcrEngine,Windows.Media.Ocr,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Graphics.Imaging,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$null = [Windows.Storage.FileAccessMode,Windows.Storage,ContentType=WindowsRuntime]

$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
}

function Invoke-Async($asyncOp) {
    $opType = $asyncOp.GetType()
    $interfaces = $opType.GetInterfaces()
    $iasync = $interfaces | Where-Object { $_.IsGenericType -and $_.GetGenericTypeDefinition().Name -match 'IAsyncOperation`1' } | Select-Object -First 1
    
    if ($iasync) {
        $resultType = $iasync.GetGenericArguments()[0]
        $method = ($asTask | Where-Object {
            $_.GetParameters()[0].ParameterType.IsGenericType
        })[0]
        $genericMethod = $method.MakeGenericMethod($resultType)
        $task = $genericMethod.Invoke($null, @([object]$asyncOp))
        return $task.GetAwaiter().GetResult()
    }
    
    $iasyncAction = $interfaces | Where-Object { $_.Name -eq 'IAsyncAction' } | Select-Object -First 1
    if ($iasyncAction) {
        $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
            $_.Name -eq 'AsTask' -and -not $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncAction'
        } | Select-Object -First 1
        $task = $method.Invoke($null, @([object]$asyncOp))
        return $task.GetAwaiter().GetResult()
    }

    throw "Cannot handle async operation of type $opType"
}

try {
    if (-not (Test-Path $PngPath)) {
        Write-Output ('{"success":false,"matches":[],"error":"File not found: ' + $PngPath.Replace('\','\\') + '"}')
        exit 1
    }

    $file = Invoke-Async ([Windows.Storage.StorageFile]::GetFileFromPathAsync($PngPath))
    $stream = Invoke-Async $file.OpenAsync([Windows.Storage.FileAccessMode]::Read)
    $decoder = Invoke-Async ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream))
    $bitmap = Invoke-Async $decoder.GetSoftwareBitmapAsync()

    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine) {
        Write-Output '{"success":false,"matches":[],"error":"OcrEngine not available"}'
        exit 1
    }

    $ocrResult = Invoke-Async $engine.RecognizeAsync($bitmap)

    $matches = @()
    foreach ($line in $ocrResult.Lines) {
        foreach ($word in $line.Words) {
            $r = $word.BoundingRect
            $bx = [math]::Round($r.X / $Scale, 2)
            $by = [math]::Round($r.Y / $Scale, 2)
            $bw = [math]::Round($r.Width / $Scale, 2)
            $bh = [math]::Round($r.Height / $Scale, 2)
            $cx = [math]::Round($bx + $bw / 2.0, 2)
            $cy = [math]::Round($by + $bh / 2.0, 2)
            $escaped = $word.Text -replace '\\','\\' -replace '"','\"' -replace "`n",'\n' -replace "`r",'\r' -replace "`t",'\t'
            $matches += "{`"text`":`"$escaped`",`"x`":$cx,`"y`":$cy,`"confidence`":1.0,`"bounds`":{`"x`":$bx,`"y`":$by,`"width`":$bw,`"height`":$bh}}"
        }
    }

    $matchesJson = $matches -join ','
    Write-Output "{`"success`":true,`"matches`":[$matchesJson],`"error`":null}"
}
catch {
    $errMsg = ($_.Exception.Message) -replace '\\','\\\\' -replace '"','\\"' -replace "`n",'\\n' -replace "`r",''
    Write-Output "{`"success`":false,`"matches`":[],`"error`":`"$errMsg`"}"
    exit 1
}
