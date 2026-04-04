import type { 
  AuthResponse, 
  LoginCredentials, 
  RegisterCredentials,
  Script,
  ScriptGenerateRequest,
  ScriptHistoryResponse,
  AIService,
  AIConfig,
  ApiResponse
} from '@/types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('auth_token');
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE}${endpoint}`;
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const renewedToken = response.headers.get('X-Renewed-Token');
    if (renewedToken) {
      this.token = renewedToken;
      localStorage.setItem('auth_token', renewedToken);
    }

    const body = await response.json().catch(() => ({ error: '请求失败' }));

    if (!response.ok) {
      throw new Error(body.error || `请求失败 (${response.status})`);
    }

    return body as T;
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('auth_token', data.token);
    }
    
    return data;
  }

  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    
    if (data.token) {
      this.token = data.token;
      localStorage.setItem('auth_token', data.token);
    }
    
    return data;
  }

  async logout(): Promise<void> {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  async getCurrentUser(): Promise<ApiResponse<{ user: any }>> {
    return this.request('/api/auth/me');
  }

  async updateProfile(data: { name?: string; currentPassword?: string; newPassword?: string }): Promise<ApiResponse> {
    return this.request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async generateScript(request: ScriptGenerateRequest): Promise<ApiResponse<{ script: Script }>> {
    return this.request('/api/scripts/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async getScriptHistory(page = 1, limit = 10): Promise<ScriptHistoryResponse> {
    return this.request(`/api/scripts/history?page=${page}&limit=${limit}`);
  }

  async getScript(id: number): Promise<ApiResponse<{ script: Script }>> {
    return this.request(`/api/scripts/${id}`);
  }

  async deleteScript(id: number): Promise<ApiResponse> {
    return this.request(`/api/scripts/${id}`, {
      method: 'DELETE',
    });
  }

  async getAIServices(): Promise<ApiResponse<{ services: AIService[] }>> {
    return this.request('/api/ai/services');
  }

  async getAIConfig(): Promise<ApiResponse<{ configs: AIConfig[] }>> {
    return this.request('/api/ai/config');
  }

  async updateAIConfig(payload: {
    serviceName: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }): Promise<ApiResponse> {
    return this.request('/api/ai/config', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async testAIConnection(payload: {
    serviceName: string;
    apiKey?: string;
    baseUrl?: string;
    model?: string;
  }): Promise<ApiResponse<{ resolvedBaseUrl?: string; resolvedModel?: string }>> {
    return this.request('/api/ai/test', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async autofillProjectParams(payload: {
    genre: string;
    script_type: string;
    ai_service: string;
    generation_mode?: 'conservative' | 'balanced' | 'wild';
  }): Promise<ApiResponse<{ suggestion: {
    title?: string;
    style?: string;
    target_platform?: string;
    target_duration?: number;
    total_episodes?: number;
    character_count?: number;
    key_points?: string[];
    characters_input?: string[];
    scene_input?: string;
  } }>> {
    return this.request('/api/ai/project-autofill', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ============================================
  // Pipeline API
  // ============================================

  async startPipeline(params: {
    title: string;
    genre: string;
    script_type: string;
    style?: string;
    target_platform?: string;
    target_duration?: number;
    character_count?: number;
    key_points?: string[];
    characters_input?: string[];
      scene_input?: string;
      ai_service: string;
      workflow_template_id?: number;
      total_episodes: number;
  }): Promise<ApiResponse<{ taskId: string }>> {
    return this.request('/api/pipeline/start', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getPipelineStatus(taskId: string): Promise<ApiResponse<{
    task: any;
    steps: any[];
    episodes: any[];
    score: any;
  }>> {
    return this.request(`/api/pipeline/${taskId}/status`);
  }

  async getPipelineEpisodes(taskId: string, page = 1, limit = 50): Promise<ApiResponse<{
    episodes: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>> {
    return this.request(`/api/pipeline/${taskId}/episodes?page=${page}&limit=${limit}`);
  }

  async getPipelineEpisode(taskId: string, episodeNumber: number): Promise<ApiResponse<{
    episode: any;
  }>> {
    return this.request(`/api/pipeline/${taskId}/episodes/${episodeNumber}`);
  }

  async pausePipeline(taskId: string): Promise<ApiResponse> {
    return this.request(`/api/pipeline/${taskId}/pause`, {
      method: 'POST',
    });
  }

  async resumePipeline(taskId: string, payload?: { ai_service?: string; ai_model?: string }): Promise<ApiResponse<{ ai_service?: string; ai_model?: string }>> {
    return this.request(`/api/pipeline/${taskId}/resume`, {
      method: 'POST',
      body: JSON.stringify(payload || {}),
    });
  }

  async cancelPipeline(taskId: string): Promise<ApiResponse> {
    return this.request(`/api/pipeline/${taskId}/cancel`, {
      method: 'POST',
    });
  }

  async exportPipeline(taskId: string, format: 'markdown' | 'json' = 'markdown'): Promise<ApiResponse<{
    content: string;
  }>> {
    return this.request(`/api/pipeline/${taskId}/export?format=${format}`);
  }

  async getPipelineList(page = 1, limit = 10): Promise<ApiResponse<{
    tasks: any[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>> {
    return this.request(`/api/pipeline/list?page=${page}&limit=${limit}`);
  }

  async getPipelineSteps(taskId: string): Promise<ApiResponse<{ steps: any[] }>> {
    return this.request(`/api/pipeline/${taskId}/steps`);
  }

  async getPipelineLogs(taskId: string): Promise<ApiResponse<{ logs: any[] }>> {
    return this.request(`/api/pipeline/${taskId}/logs`);
  }

  async getPipelineStepContent(taskId: string, stepNumber: number): Promise<ApiResponse<any>> {
    return this.request(`/api/pipeline/${taskId}/steps/${stepNumber}/content`);
  }

  async getPipelineVersions(taskId: string): Promise<ApiResponse<{ versions: any[] }>> {
    return this.request(`/api/pipeline/${taskId}/versions`);
  }

  async getPipelineVersionDetail(taskId: string, versionId: number): Promise<ApiResponse<{ version: any }>> {
    return this.request(`/api/pipeline/${taskId}/versions/${versionId}`);
  }

  async createPipelineVersion(taskId: string, payload: { label?: string; changeNotes?: string }): Promise<ApiResponse<{ version: any }>> {
    return this.request(`/api/pipeline/${taskId}/versions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async branchPipelineVersion(taskId: string, versionId: number, payload: { label?: string; changeNotes?: string }): Promise<ApiResponse<{ version: any }>> {
    return this.request(`/api/pipeline/${taskId}/versions/${versionId}/branch`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async comparePipelineVersions(taskId: string, payload: { baseVersionId: number; targetVersionId: number }): Promise<ApiResponse<{ baseVersion: any; targetVersion: any; diff: any[] }>> {
    return this.request(`/api/pipeline/${taskId}/versions/compare`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getPipelineEditor(taskId: string): Promise<ApiResponse<{ draft: any; content: string; title: string; sourceVersion: any }>> {
    return this.request(`/api/pipeline/${taskId}/editor`);
  }

  async savePipelineDraft(taskId: string, payload: { title?: string; content: string; sourceVersionId?: number | null }): Promise<ApiResponse> {
    return this.request(`/api/pipeline/${taskId}/editor`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async publishPipelineDraft(taskId: string, payload: { label?: string; changeNotes?: string; content?: string }): Promise<ApiResponse<{ version: any }>> {
    return this.request(`/api/pipeline/${taskId}/editor/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getWorkflowTemplates(): Promise<ApiResponse<{ templates: any[] }>> {
    return this.request('/api/studio/workflows');
  }

  async getWorkflowTemplate(templateId: number): Promise<ApiResponse<{ template: any }>> {
    return this.request(`/api/studio/workflows/${templateId}`);
  }

  async createWorkflowTemplate(payload: { name: string; description?: string; is_default?: boolean; nodes: any[] }): Promise<ApiResponse<{ template: any }>> {
    return this.request('/api/studio/workflows', { method: 'POST', body: JSON.stringify(payload) });
  }

  async updateWorkflowTemplate(templateId: number, payload: { name?: string; description?: string; is_default?: boolean; nodes: any[] }): Promise<ApiResponse<{ template: any }>> {
    return this.request(`/api/studio/workflows/${templateId}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  async getPromptTemplates(): Promise<ApiResponse<{ templates: any[] }>> {
    return this.request('/api/studio/prompt-templates');
  }

  async updatePromptTemplate(nodeKey: string, payload: { name?: string; description?: string; system_prompt: string; task_instruction: string; extra_rules: string[]; model_config?: any }): Promise<ApiResponse<{ templates: any[] }>> {
    return this.request(`/api/studio/prompt-templates/${nodeKey}`, { method: 'PUT', body: JSON.stringify(payload) });
  }

  async resetPromptTemplate(nodeKey: string): Promise<ApiResponse<{ template: any }>> {
    return this.request(`/api/studio/prompt-templates/${nodeKey}/reset`, { method: 'POST' });
  }

  async publishPromptTemplate(nodeKey: string, payload: { templateId: number; releaseTag: string }): Promise<ApiResponse<{ templates: any[] }>> {
    return this.request(`/api/studio/prompt-templates/${nodeKey}/publish`, { method: 'POST', body: JSON.stringify(payload) });
  }

  async rollbackPromptTemplate(nodeKey: string, payload: { templateId: number }): Promise<ApiResponse<{ templates: any[] }>> {
    return this.request(`/api/studio/prompt-templates/${nodeKey}/rollback`, { method: 'POST', body: JSON.stringify(payload) });
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();
export default apiService;
