import type { MasterProduct, ProductDesignVersion } from "@shared/schema";
import type { ChannelType } from "../adapters/base";

interface SKUComponents {
  productCode: string;
  designVersion: string;
  variantCode: string;
  channelCode: string;
}

interface VariantInfo {
  size?: string;
  color?: string;
  colorHex?: string;
}

const CHANNEL_CODES: Record<ChannelType, string> = {
  printify: "PY",
  printful: "PF",
  apliiq: "AQ",
  etsy: "ET",
  ebay: "EB",
  amazon: "AZ",
};

const SIZE_CODES: Record<string, string> = {
  "xs": "XS",
  "extra small": "XS",
  "s": "SM",
  "small": "SM",
  "m": "MD",
  "medium": "MD",
  "l": "LG",
  "large": "LG",
  "xl": "XL",
  "extra large": "XL",
  "2xl": "2X",
  "xxl": "2X",
  "3xl": "3X",
  "xxxl": "3X",
  "4xl": "4X",
  "5xl": "5X",
  "one size": "OS",
  "os": "OS",
};

const COLOR_CODES: Record<string, string> = {
  "black": "BLK",
  "white": "WHT",
  "red": "RED",
  "blue": "BLU",
  "navy": "NVY",
  "navy blue": "NVY",
  "green": "GRN",
  "forest green": "FGN",
  "yellow": "YLW",
  "orange": "ORG",
  "purple": "PUR",
  "pink": "PNK",
  "gray": "GRY",
  "grey": "GRY",
  "charcoal": "CHR",
  "heather grey": "HGY",
  "heather gray": "HGY",
  "brown": "BRN",
  "tan": "TAN",
  "beige": "BGE",
  "cream": "CRM",
  "gold": "GLD",
  "silver": "SLV",
  "maroon": "MRN",
  "burgundy": "BRG",
  "teal": "TEL",
  "turquoise": "TRQ",
  "coral": "CRL",
  "mint": "MNT",
  "olive": "OLV",
  "khaki": "KHK",
  "slate": "SLT",
};

export class SKUGenerator {
  generateProductCode(masterProduct: MasterProduct): string {
    const prefix = this.extractPrefix(masterProduct.productType || "ITEM");
    const idPart = this.generateIdCode(masterProduct.id);
    return `${prefix}${idPart}`;
  }

  private generateIdCode(id: string): string {
    const hash = id.split("").reduce((acc, char) => {
      return ((acc << 5) - acc) + char.charCodeAt(0);
    }, 0);
    return Math.abs(hash % 10000).toString().padStart(4, "0");
  }

  generateDesignVersionCode(designVersion: ProductDesignVersion): string {
    return `V${this.padNumber(designVersion.versionNumber, 2)}`;
  }

  generateVariantCode(variant: VariantInfo): string {
    const sizeCode = this.getSizeCode(variant.size || "OS");
    const colorCode = this.getColorCode(variant.color || "UNK", variant.colorHex);
    return `${sizeCode}-${colorCode}`;
  }

  generateChannelCode(channel: ChannelType): string {
    return CHANNEL_CODES[channel] || channel.substring(0, 2).toUpperCase();
  }

  generateFullSKU(
    masterProduct: MasterProduct,
    designVersion: ProductDesignVersion,
    variant: VariantInfo,
    channel: ChannelType
  ): string {
    const components = this.generateSKUComponents(masterProduct, designVersion, variant, channel);
    return `${components.productCode}-${components.designVersion}-${components.variantCode}-${components.channelCode}`;
  }

  generateSKUComponents(
    masterProduct: MasterProduct,
    designVersion: ProductDesignVersion,
    variant: VariantInfo,
    channel: ChannelType
  ): SKUComponents {
    return {
      productCode: this.generateProductCode(masterProduct),
      designVersion: this.generateDesignVersionCode(designVersion),
      variantCode: this.generateVariantCode(variant),
      channelCode: this.generateChannelCode(channel),
    };
  }

  generateBaseSKU(
    masterProduct: MasterProduct,
    designVersion: ProductDesignVersion,
    variant: VariantInfo
  ): string {
    const productCode = this.generateProductCode(masterProduct);
    const versionCode = this.generateDesignVersionCode(designVersion);
    const variantCode = this.generateVariantCode(variant);
    return `${productCode}-${versionCode}-${variantCode}`;
  }

  generateChannelSKU(baseSKU: string, channel: ChannelType): string {
    const channelCode = this.generateChannelCode(channel);
    return `${baseSKU}-${channelCode}`;
  }

  parseSKU(sku: string): Partial<SKUComponents> {
    const parts = sku.split("-");
    
    if (parts.length >= 4) {
      const channelCode = parts[parts.length - 1];
      const variantParts = parts.slice(2, parts.length - 1);
      
      return {
        productCode: parts[0],
        designVersion: parts[1],
        variantCode: variantParts.join("-"),
        channelCode: channelCode,
      };
    }
    
    if (parts.length === 3) {
      return {
        productCode: parts[0],
        designVersion: parts[1],
        variantCode: parts[2],
      };
    }
    
    return {};
  }

  validateSKU(sku: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!sku || typeof sku !== "string") {
      errors.push("SKU must be a non-empty string");
      return { isValid: false, errors };
    }

    const cleanSKU = sku.trim().toUpperCase();
    
    if (cleanSKU.length < 8) {
      errors.push("SKU is too short (minimum 8 characters)");
    }
    
    if (cleanSKU.length > 50) {
      errors.push("SKU is too long (maximum 50 characters)");
    }

    if (!/^[A-Z0-9-]+$/.test(cleanSKU)) {
      errors.push("SKU must only contain letters, numbers, and hyphens");
    }

    if (cleanSKU.startsWith("-") || cleanSKU.endsWith("-")) {
      errors.push("SKU cannot start or end with a hyphen");
    }

    if (cleanSKU.includes("--")) {
      errors.push("SKU cannot contain consecutive hyphens");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  generateBulkSKUs(
    masterProduct: MasterProduct,
    designVersion: ProductDesignVersion,
    variants: VariantInfo[],
    channels: ChannelType[]
  ): Map<string, string> {
    const skuMap = new Map<string, string>();

    for (const variant of variants) {
      const baseSKU = this.generateBaseSKU(masterProduct, designVersion, variant);
      const variantKey = `${variant.size || "OS"}-${variant.color || "UNK"}`;
      
      skuMap.set(`base:${variantKey}`, baseSKU);

      for (const channel of channels) {
        const channelSKU = this.generateChannelSKU(baseSKU, channel);
        skuMap.set(`${channel}:${variantKey}`, channelSKU);
      }
    }

    return skuMap;
  }

  private extractPrefix(productType: string): string {
    const normalized = productType.toUpperCase().trim();
    
    const typeMap: Record<string, string> = {
      "T-SHIRT": "TS",
      "TSHIRT": "TS",
      "TEE": "TS",
      "HOODIE": "HD",
      "SWEATSHIRT": "SW",
      "TANK": "TK",
      "TANK TOP": "TK",
      "LONG SLEEVE": "LS",
      "POLO": "PL",
      "MUG": "MG",
      "HAT": "HT",
      "CAP": "CP",
      "BAG": "BG",
      "TOTE": "TT",
      "POSTER": "PS",
      "PHONE CASE": "PC",
      "STICKER": "SK",
      "PILLOW": "PW",
      "BLANKET": "BL",
    };

    for (const [key, code] of Object.entries(typeMap)) {
      if (normalized.includes(key)) {
        return code;
      }
    }

    const words = normalized.split(/\s+/);
    if (words.length >= 2) {
      return words[0][0] + words[1][0];
    }
    
    return normalized.substring(0, 2);
  }

  private getSizeCode(size: string): string {
    const normalized = size.toLowerCase().trim();
    return SIZE_CODES[normalized] || size.substring(0, 2).toUpperCase();
  }

  private getColorCode(color: string, colorHex?: string): string {
    const normalized = color.toLowerCase().trim();
    
    if (COLOR_CODES[normalized]) {
      return COLOR_CODES[normalized];
    }

    if (colorHex) {
      return colorHex.replace("#", "").substring(0, 3).toUpperCase();
    }

    const words = normalized.split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1].substring(0, 2)).toUpperCase();
    }
    
    return normalized.substring(0, 3).toUpperCase();
  }

  private padNumber(num: number, length: number): string {
    return String(num).padStart(length, "0");
  }
}

export const skuGenerator = new SKUGenerator();
