// Mock data until Person A & B finish their parts

export const MOCK_BRAND_PROFILE = {
  fonts: {
    heading: "Poppins",
    body: "Inter",
    h1_size: 48,
    h2_size: 36,
    h3_size: 24,
    body_size: 16,
    caption_size: 12
  },
  colors: {
    primary: "#1E40AF",
    secondary: "#64748B",
    accent: "#FACC15",
    background: "#FFFFFF",
    text: "#1F2937"
  },
  spacing: { padding: 24, margin: 16, gap: 12 },
  borders: { radius: 12, width: 2, style: "solid" },
  shadows: { enabled: true, x: 0, y: 4, blur: 12, color: "#00000015" }
};

export const MOCK_FIX_ACTIONS = [
  { action: "update_font_size", element_id: "text_1", value: 14 },
  { action: "update_color", element_id: "text_2", value: "#1E40AF", color_type: "primary" },
  { action: "update_font_family", element_id: "text_3", value: "Poppins", font_type: "heading" }
];
