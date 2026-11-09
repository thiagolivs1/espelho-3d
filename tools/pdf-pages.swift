// Renderiza páginas de um PDF em JPG (PDFKit, macOS).
// Uso: swift tools/pdf-pages.swift <pdf> <pasta-saída> <largura-px> <páginas, ex.: 1,8,9,41-46>
// Saída: <pasta>/pNN.jpg
import Foundation
import PDFKit
import AppKit

let args = CommandLine.arguments
guard args.count == 5 else {
    FileHandle.standardError.write("uso: swift tools/pdf-pages.swift <pdf> <saída> <largura> <páginas>\n".data(using: .utf8)!)
    exit(2)
}
guard let doc = PDFDocument(url: URL(fileURLWithPath: args[1])) else { print("não abriu o PDF"); exit(1) }
let outDir = args[2]
let width = CGFloat(Double(args[3]) ?? 1400)
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

var pages: [Int] = []
for part in args[4].split(separator: ",") {
    let r = part.split(separator: "-").compactMap { Int($0) }
    if r.count == 2 { pages += Array(r[0]...r[1]) } else if r.count == 1 { pages.append(r[0]) }
}

for n in pages {
    guard let page = doc.page(at: n - 1) else { print("página \(n) não existe"); continue }
    let box = page.bounds(for: .mediaBox)
    let scale = width / box.width
    let img = page.thumbnail(of: NSSize(width: box.width * scale, height: box.height * scale), for: .mediaBox)
    guard let tiff = img.tiffRepresentation, let rep = NSBitmapImageRep(data: tiff),
          let jpg = rep.representation(using: .jpeg, properties: [.compressionFactor: 0.85]) else { continue }
    let path = String(format: "%@/p%02d.jpg", outDir, n)
    try? jpg.write(to: URL(fileURLWithPath: path))
    print("\(path) \(rep.pixelsWide)x\(rep.pixelsHigh)")
}
