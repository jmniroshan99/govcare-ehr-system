declare module "file-saver" {
  export interface FileSaverOptions {
    autoBom?: boolean;
  }

  export function saveAs(
    data: Blob | File | string,
    filename?: string,
    options?: FileSaverOptions,
  ): void;
}
