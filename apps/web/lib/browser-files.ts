import type { PublishFile } from '@sitedrop/core/prepare'
import { stripCommonRoot } from '@sitedrop/core/tree'
import { filesFromZip, isZip } from '@sitedrop/core/zip'

function readFile(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => entry.file(resolve, reject))
}

/** `readEntries` yields at most ~100 entries per call and signals completion with an empty batch. */
async function readAllEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  const all: FileSystemEntry[] = []

  for (;;) {
    const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
      reader.readEntries(resolve, reject),
    )
    if (batch.length === 0) return all
    all.push(...batch)
  }
}

async function walk(entry: FileSystemEntry, prefix: string, out: PublishFile[]): Promise<void> {
  if (entry.isFile) {
    out.push({ relPath: `${prefix}${entry.name}`, body: await readFile(entry as FileSystemFileEntry) })
    return
  }

  const reader = (entry as FileSystemDirectoryEntry).createReader()
  for (const child of await readAllEntries(reader)) {
    await walk(child, `${prefix}${entry.name}/`, out)
  }
}

async function unzipOne(file: File): Promise<PublishFile[]> {
  return filesFromZip(new Uint8Array(await file.arrayBuffer()))
}

export async function filesFromDataTransfer(transfer: DataTransfer): Promise<PublishFile[]> {
  const entries = [...transfer.items]
    .map((item) => item.webkitGetAsEntry())
    .filter((entry): entry is FileSystemEntry => entry !== null)

  if (entries.length === 1 && entries[0]!.isFile && isZip(entries[0]!.name)) {
    return unzipOne(await readFile(entries[0] as FileSystemFileEntry))
  }

  const collected: PublishFile[] = []
  for (const entry of entries) await walk(entry, '', collected)

  return stripCommonRoot(collected)
}

export async function filesFromFileList(list: FileList): Promise<PublishFile[]> {
  const files = [...list]

  if (files.length === 1 && isZip(files[0]!.name)) return unzipOne(files[0]!)

  return stripCommonRoot(
    files.map((file) => ({ relPath: file.webkitRelativePath || file.name, body: file })),
  )
}
