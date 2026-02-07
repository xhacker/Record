// Centralized AI configuration
export const AI_CONFIG = {
  // Model for Ask AI panel
  askModel: 'kimi',
  // Model for slash commands
  commandModel: 'kimi',

  // Temperature settings
  askTemperature: 0.6,
  commandTemperature: 0.3,

  // Token limits
  askMaxTokens: 1200,
  commandMaxTokens: 600,

  // Enable agent tools (list_files, read_file, etc.) for Ask AI
  useTools: true,
};
