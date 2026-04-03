// 用户相关类型
export interface User {
  id: number;
  email: string;
  name: string;
  created_at: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

// 剧本相关类型
export interface Script {
  id: number;
  title: string;
  content: string;
  genre: string;
  characters: string[];
  scene: string;
  length: 'short' | 'medium' | 'long';
  key_points: string[];
  ai_service: string;
  script_type: ScriptType;
  created_at: string;
  preview?: string;
}

export type ScriptType = 'movie' | 'tv' | 'short-video' | 'commercial' | 'novel';

export interface ScriptGenerateRequest {
  title: string;
  genre: string;
  characters: string[];
  scene: string;
  length: 'short' | 'medium' | 'long';
  key_points: string[];
  ai_service: string;
  script_type: ScriptType;
}

export interface ScriptHistoryResponse {
  success: boolean;
  scripts: Script[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// AI服务相关类型
export interface AIService {
  id: string;
  name: string;
  description: string;
  protocol?: 'cloudflare' | 'openai-compatible' | 'anthropic';
  requiresApiKey: boolean;
  requiresBaseUrl?: boolean;
  requiresModel?: boolean;
  supportsModelListing?: boolean;
  isDefault?: boolean;
  apiKeyFormat?: string;
  defaultBaseUrl?: string;
  defaultModel?: string;
  tags?: string[];
}

export interface AIConfig {
  id: number;
  service_name: string;
  base_url?: string | null;
  model?: string | null;
  is_active: boolean;
  validation_status?: 'pending' | 'passed' | 'failed' | null;
  last_checked_at?: string | null;
  last_check_message?: string | null;
  created_at: string;
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

// 表单类型
export interface ScriptFormData {
  title: string;
  genre: string;
  characters: string[];
  scene: string;
  length: 'short' | 'medium' | 'long';
  keyPoints: string[];
  scriptType: ScriptType;
  aiService: string;
}

// 题材选项
export const GENRE_OPTIONS = [
  { value: 'sci-fi', label: '科幻' },
  { value: 'romance', label: '爱情' },
  { value: 'action', label: '动作' },
  { value: 'comedy', label: '喜剧' },
  { value: 'drama', label: '剧情' },
  { value: 'horror', label: '恐怖' },
  { value: 'thriller', label: '悬疑' },
  { value: 'fantasy', label: '奇幻' },
  { value: 'historical', label: '历史' },
  { value: 'documentary', label: '纪实' },
];

// 剧本类型选项
export const SCRIPT_TYPE_OPTIONS = [
  { value: 'movie', label: '电影', description: '标准电影剧本格式' },
  { value: 'tv', label: '电视剧', description: '电视剧分集剧本' },
  { value: 'short-video', label: '短视频', description: '抖音、YouTube短视频脚本' },
  { value: 'commercial', label: '广告', description: '广告、宣传片脚本' },
  { value: 'novel', label: '小说', description: '故事大纲或小说' },
];

// 长度选项
export const LENGTH_OPTIONS = [
  { value: 'short', label: '短篇', description: '5-10分钟' },
  { value: 'medium', label: '中篇', description: '15-30分钟' },
  { value: 'long', label: '长篇', description: '30分钟以上' },
];
