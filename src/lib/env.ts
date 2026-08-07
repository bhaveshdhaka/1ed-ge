import 'dotenv/config'

export const env = {
  adminSecret: () => process.env.ADMIN_SECRET ?? '',
  openrouterKey: () => process.env.OPENROUTER_API_KEY ?? '',
  openrouterBase: () => process.env.OPENROUTER_BASE ?? 'https://openrouter.ai/api/v1',
  modelStructure: () => process.env.AI_MODEL_STRUCTURE ?? 'deepseek/deepseek-chat',
  modelVision: () => process.env.AI_MODEL_VISION ?? 'qwen/qwen-2.5-vl-72b-instruct',
  modelAssist: () => process.env.AI_MODEL_ASSIST ?? 'deepseek/deepseek-chat',
  modelAlt: () => process.env.AI_MODEL_ALT ?? 'qwen/qwen-2.5-vl-7b-instruct',
  siteUrl: () => process.env.SITE_URL ?? 'https://1ed.ge',
}
