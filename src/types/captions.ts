export interface CaptionSegment {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  confidence: number;
}

// Base styling properties that map directly to FFmpeg
export interface CaptionStyle {
  // Core positioning and layout
  position: {
    type: 'bottom' | 'center' | 'top' | 'custom';
    x?: number; // Custom X position (0-1 as percentage of video width)
    y?: number; // Custom Y position (0-1 as percentage of video height)
    margin: number; // Margin from edges in pixels
  };

  // Typography
  typography: {
    fontFamily: string;
    fontSize: number;
    fontWeight: 'normal' | 'bold' | 'light';
    fontColor: string; // Hex color
    textAlign: 'left' | 'center' | 'right';
    lineHeight?: number; // Line spacing multiplier
    letterSpacing?: number; // Character spacing in pixels
  };

  // Background and borders
  background: {
    enabled: boolean;
    color: string; // Hex color with alpha
    opacity: number; // 0-1
    borderRadius: number; // Corner radius in pixels
    padding: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
  };

  border: {
    enabled: boolean;
    color: string; // Hex color
    width: number; // Border width in pixels
    style: 'solid' | 'dashed' | 'dotted';
  };

  // Shadow effects
  shadow: {
    enabled: boolean;
    color: string; // Hex color
    blur: number; // Blur radius in pixels
    offsetX: number; // Horizontal offset in pixels
    offsetY: number; // Vertical offset in pixels
  };

  // Animation and transitions
  animation: {
    type: 'none' | 'fade' | 'slide' | 'bounce' | 'typewriter';
    duration: number; // Animation duration in seconds
    delay: number; // Delay before animation starts in seconds
    easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bounce';
  };

  // Advanced effects
  effects: {
    opacity: number; // Overall opacity 0-1
    rotation: number; // Rotation in degrees
    scale: number; // Scale factor (1.0 = normal size)
    blur: number; // Background blur in pixels
  };

  // Preset system for common styles
  preset?: 'reel' | 'classic' | 'modern' | 'minimal' | 'bold' | 'elegant';
}

// Predefined styling presets for common use cases
export const CAPTION_STYLE_PRESETS: Record<string, CaptionStyle> = {
  reel: {
    position: { type: 'bottom', margin: 20 },
    typography: {
      fontFamily: 'Arial',
      fontSize: 24,
      fontWeight: 'bold',
      fontColor: '#FFFFFF',
      textAlign: 'center',
    },
    background: {
      enabled: true,
      color: '#000000',
      opacity: 0.8,
      borderRadius: 8,
      padding: { top: 12, right: 16, bottom: 12, left: 16 },
    },
    border: { enabled: false, color: '#000000', width: 0, style: 'solid' },
    shadow: {
      enabled: true,
      color: '#000000',
      blur: 4,
      offsetX: 0,
      offsetY: 2,
    },
    animation: { type: 'fade', duration: 0.3, delay: 0, easing: 'ease-out' },
    effects: { opacity: 1, rotation: 0, scale: 1, blur: 0 },
  },

  classic: {
    position: { type: 'bottom', margin: 30 },
    typography: {
      fontFamily: 'Times New Roman',
      fontSize: 20,
      fontWeight: 'normal',
      fontColor: '#FFFFFF',
      textAlign: 'center',
    },
    background: {
      enabled: true,
      color: '#000000',
      opacity: 0.7,
      borderRadius: 0,
      padding: { top: 8, right: 12, bottom: 8, left: 12 },
    },
    border: { enabled: false, color: '#000000', width: 0, style: 'solid' },
    shadow: {
      enabled: false,
      color: '#000000',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
    },
    animation: { type: 'none', duration: 0, delay: 0, easing: 'linear' },
    effects: { opacity: 1, rotation: 0, scale: 1, blur: 0 },
  },

  modern: {
    position: { type: 'bottom', margin: 25 },
    typography: {
      fontFamily: 'Helvetica',
      fontSize: 22,
      fontWeight: 'normal',
      fontColor: '#FFFFFF',
      textAlign: 'center',
    },
    background: {
      enabled: true,
      color: '#1A1A1A',
      opacity: 0.9,
      borderRadius: 12,
      padding: { top: 10, right: 14, bottom: 10, left: 14 },
    },
    border: { enabled: true, color: '#FFFFFF', width: 1, style: 'solid' },
    shadow: {
      enabled: true,
      color: '#000000',
      blur: 6,
      offsetX: 0,
      offsetY: 3,
    },
    animation: { type: 'slide', duration: 0.4, delay: 0, easing: 'ease-out' },
    effects: { opacity: 1, rotation: 0, scale: 1, blur: 0 },
  },

  minimal: {
    position: { type: 'bottom', margin: 15 },
    typography: {
      fontFamily: 'Arial',
      fontSize: 18,
      fontWeight: 'light',
      fontColor: '#FFFFFF',
      textAlign: 'center',
    },
    background: {
      enabled: false,
      color: '#000000',
      opacity: 0,
      borderRadius: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    border: { enabled: false, color: '#000000', width: 0, style: 'solid' },
    shadow: {
      enabled: true,
      color: '#000000',
      blur: 3,
      offsetX: 0,
      offsetY: 1,
    },
    animation: { type: 'fade', duration: 0.2, delay: 0, easing: 'ease-in-out' },
    effects: { opacity: 0.95, rotation: 0, scale: 1, blur: 0 },
  },
};

// Utility function to create style from preset
export function createStyleFromPreset(
  presetName: string,
  overrides?: Partial<CaptionStyle>
): CaptionStyle {
  const baseStyle =
    CAPTION_STYLE_PRESETS[presetName] || CAPTION_STYLE_PRESETS.classic;

  if (!overrides) return baseStyle;

  // Deep merge the overrides with the base style
  return {
    ...baseStyle,
    ...overrides,
    position: { ...baseStyle.position, ...overrides.position },
    typography: { ...baseStyle.typography, ...overrides.typography },
    background: { ...baseStyle.background, ...overrides.background },
    border: { ...baseStyle.border, ...overrides.border },
    shadow: { ...baseStyle.shadow, ...overrides.shadow },
    animation: { ...baseStyle.animation, ...overrides.animation },
    effects: { ...baseStyle.effects, ...overrides.effects },
  };
}

// Validation functions for styling properties
export function validateCaptionStyle(style: CaptionStyle): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validate position
  if (style.position) {
    if (style.position.type === 'custom') {
      if (
        style.position.x !== undefined &&
        (style.position.x < 0 || style.position.x > 1)
      ) {
        errors.push('Custom X position must be between 0 and 1');
      }
      if (
        style.position.y !== undefined &&
        (style.position.y < 0 || style.position.y > 1)
      ) {
        errors.push('Custom Y position must be between 0 and 1');
      }
    }
  } else {
    errors.push('Position configuration is required');
  }

  // Validate typography
  if (style.typography) {
    if (style.typography.fontSize < 8 || style.typography.fontSize > 200) {
      errors.push('Font size must be between 8 and 200');
    }

    if (!isValidHexColor(style.typography.fontColor)) {
      errors.push('Font color must be a valid hex color');
    }
  } else {
    errors.push('Typography configuration is required');
  }

  // Validate background
  if (style.background) {
    if (style.background.enabled) {
      if (!isValidHexColor(style.background.color)) {
        errors.push('Background color must be a valid hex color');
      }
      if (style.background.opacity < 0 || style.background.opacity > 1) {
        errors.push('Background opacity must be between 0 and 1');
      }
    }
  } else {
    errors.push('Background configuration is required');
  }

  // Validate border
  if (style.border) {
    if (style.border.enabled) {
      if (!isValidHexColor(style.border.color)) {
        errors.push('Border color must be a valid hex color');
      }
      if (style.border.width < 0 || style.border.width > 20) {
        errors.push('Border width must be between 0 and 20');
      }
    }
  } else {
    errors.push('Border configuration is required');
  }

  // Validate shadow
  if (style.shadow) {
    if (style.shadow.enabled) {
      if (!isValidHexColor(style.shadow.color)) {
        errors.push('Shadow color must be a valid hex color');
      }
    }
  } else {
    errors.push('Shadow configuration is required');
  }

  // Validate effects
  if (style.effects) {
    if (style.effects.opacity < 0 || style.effects.opacity > 1) {
      errors.push('Effects opacity must be between 0 and 1');
    }

    if (style.effects.scale < 0.1 || style.effects.scale > 5) {
      errors.push('Effects scale must be between 0.1 and 5');
    }
  } else {
    errors.push('Effects configuration is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Helper function to validate hex colors and RGBA values
function isValidHexColor(color: string): boolean {
  const hexPattern = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  const rgbaPattern =
    /^rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(,\s*[\d.]+\s*)?\)$/;
  return hexPattern.test(color) || rgbaPattern.test(color);
}

// Helper function to normalize and validate style before processing
export function normalizeCaptionStyle(style: CaptionStyle): CaptionStyle {
  const normalized = { ...style };

  // Ensure all required properties have defaults
  if (!normalized.position) {
    normalized.position = { type: 'bottom', margin: 20 };
  }

  if (!normalized.typography) {
    normalized.typography = {
      fontFamily: 'Arial',
      fontSize: 20,
      fontWeight: 'normal',
      fontColor: '#FFFFFF',
      textAlign: 'center',
    };
  }

  if (!normalized.background) {
    normalized.background = {
      enabled: false,
      color: '#000000',
      opacity: 0.8,
      borderRadius: 0,
      padding: { top: 0, right: 0, bottom: 0, left: 0 },
    };
  }

  if (!normalized.border) {
    normalized.border = {
      enabled: false,
      color: '#000000',
      width: 0,
      style: 'solid',
    };
  }

  if (!normalized.shadow) {
    normalized.shadow = {
      enabled: false,
      color: '#000000',
      blur: 0,
      offsetX: 0,
      offsetY: 0,
    };
  }

  if (!normalized.animation) {
    normalized.animation = {
      type: 'none',
      duration: 0,
      delay: 0,
      easing: 'linear',
    };
  }

  if (!normalized.effects) {
    normalized.effects = {
      opacity: 1,
      rotation: 0,
      scale: 1,
      blur: 0,
    };
  }

  return normalized;
}

export interface CaptionGenerationRequest {
  videoId: string;
  transcript: string;
  style: CaptionStyle;
  options: {
    maxSegmentDuration: number;
    minSegmentDuration: number;
    wordPerMinute: number;
  };
}

export interface CaptionGenerationResponse {
  jobId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  captions?: CaptionSegment[];
  error?: string;
}
