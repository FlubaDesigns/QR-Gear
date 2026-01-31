declare module 'qrcode-svg' {
  interface QRCodeOptions {
    content: string;
    width?: number;
    height?: number;
    color?: string;
    background?: string;
    ecl?: 'L' | 'M' | 'Q' | 'H';
    padding?: number;
    join?: boolean;
    predefined?: boolean;
    pretty?: boolean;
    swap?: boolean;
    xmlDeclaration?: boolean;
    container?: 'svg' | 'svg-viewbox' | 'none';
  }

  class QRCode {
    constructor(options: QRCodeOptions);
    svg(): string;
  }

  export = QRCode;
}
