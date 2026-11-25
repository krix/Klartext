declare module 'node:fs' {
  interface FileBytes extends Uint8Array {
    readUInt32BE(offset: number): number;
    toString(encoding?: string): string;
  }
  export function readFileSync(path: URL | string, encoding: string): string;
  export function readFileSync(path: URL | string): FileBytes;
}
