import Foundation
import Vision
import ImageIO
import CoreFoundation

struct TextBounds: Encodable {
    let x: Double
    let y: Double
    let width: Double
    let height: Double
}

struct TextMatch: Encodable {
    let text: String
    let x: Double
    let y: Double
    let confidence: Double
    let bounds: TextBounds
}

struct OCRResult: Encodable {
    let success: Bool
    let matches: [TextMatch]
    let error: String?
}

func convertVisionBBox(
    normX: Double, normY: Double,
    normW: Double, normH: Double,
    imgW: Double, imgH: Double,
    scale: Double
) -> (centerX: Double, centerY: Double, bounds: TextBounds) {
    let px = normX * imgW
    let pw = normW * imgW
    let ph = normH * imgH
    let py = (1.0 - normY - normH) * imgH

    let centerX = (px + pw / 2.0) / scale
    let centerY = (py + ph / 2.0) / scale

    let bounds = TextBounds(
        x: px / scale,
        y: py / scale,
        width: pw / scale,
        height: ph / scale
    )

    return (centerX, centerY, bounds)
}

func runOCR(pngData: Data, scale: Double) -> OCRResult {
    guard let imageSource = CGImageSourceCreateWithData(pngData as CFData, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(imageSource, 0, nil) else {
        return OCRResult(success: false, matches: [], error: "Failed to create CGImage from PNG data")
    }

    let imgW = Double(cgImage.width)
    let imgH = Double(cgImage.height)

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    let request = VNRecognizeTextRequest()
    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = false

    do {
        try handler.perform([request])
    } catch {
        return OCRResult(success: false, matches: [], error: "Vision OCR failed: \(error.localizedDescription)")
    }

    guard let observations = request.results else {
        return OCRResult(success: true, matches: [], error: nil)
    }

    var matches: [TextMatch] = []

    for observation in observations {
        guard let candidate = observation.topCandidates(1).first else { continue }

        let bbox = observation.boundingBox
        let (centerX, centerY, bounds) = convertVisionBBox(
            normX: bbox.origin.x,
            normY: bbox.origin.y,
            normW: bbox.width,
            normH: bbox.height,
            imgW: imgW,
            imgH: imgH,
            scale: scale
        )

        matches.append(TextMatch(
            text: candidate.string,
            x: centerX,
            y: centerY,
            confidence: Double(candidate.confidence),
            bounds: bounds
        ))
    }

    return OCRResult(success: true, matches: matches, error: nil)
}

// MARK: - Main

let scaleArg = CommandLine.arguments.count > 1 ? Double(CommandLine.arguments[1]) ?? 2.0 : 2.0

var pngData = Data()
let bytesRead = FileHandle.standardInput.readData(ofLength: 10 * 1024 * 1024)
pngData.append(bytesRead)

// Read remaining data if any
while true {
    let chunk = FileHandle.standardInput.availableData
    if chunk.isEmpty { break }
    pngData.append(chunk)
}

if pngData.isEmpty {
    let errorResult = OCRResult(success: false, matches: [], error: "No PNG data received on stdin")
    let encoder = JSONEncoder()
    if let jsonData = try? encoder.encode(errorResult) {
        FileHandle.standardOutput.write(jsonData)
    }
    exit(1)
}

let result = runOCR(pngData: pngData, scale: scaleArg)

let encoder = JSONEncoder()
if let jsonData = try? encoder.encode(result) {
    FileHandle.standardOutput.write(jsonData)
} else {
    FileHandle.standardOutput.write(Data("{\"success\":false,\"matches\":[],\"error\":\"JSON encoding failed\"}".utf8))
}
