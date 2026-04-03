import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import apiService from '@/services/api';
import { connectSSE, closeSSE } from '@/services/sse';
import type { SSEProgressEvent, SSEEpisodeEvent, SSEDoneEvent, SSELogEvent } from '@/services/sse';

export interface PipelineTask {
  id: string;
  title: string;
  genre: string;
  script_type: string;
  ai_service: string;
  ai_model?: string | null;
  total_episodes: number;
  completed_episodes: number;
  current_step: number;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PipelineEpisode {
  episode_number: number;
  title: string;
  status: string;
  word_count: number;
  content?: string;
  summary?: string;
}

export interface PipelineStep {
  step_number: number;
  step_name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  content?: string;
  error_message?: string;
  current_task_summary?: string | null;
  started_at?: string;
  completed_at?: string;
}

export interface PipelineRealtimeLog {
  id: number;
  taskId: string;
  level: 'info' | 'success' | 'warning' | 'error';
  step?: number;
  stepName?: string;
  episodeNumber?: number;
  message: string;
  detail?: string;
  timestamp: string;
}

export interface PipelineScore {
  plot_score: number;
  dialogue_score: number;
  character_score: number;
  pacing_score: number;
  creativity_score: number;
  overall_score: number;
  suggestions: string[];
}

export interface PipelineVersionSummary {
  id: number;
  task_id: string;
  version: number;
  label: string | null;
  change_notes: string | null;
  created_at: string;
}

export interface PipelineVersionDetail extends PipelineVersionSummary {
  content: string;
}

const STEP_LABELS: Record<string, string> = {
  story_outline: '故事大纲',
  characters: '角色设定',
  plot_structure: '剧情结构',
  episode_plan: '集数计划',
  scenes: '场景生成',
  dialogue: '对白生成',
  compose: '剧本合成',
  evaluate: '剧本评分',
};

export const usePipelineStore = defineStore('pipeline', () => {
  // State
  const tasks = ref<PipelineTask[]>([]);
  const currentTask = ref<PipelineTask | null>(null);
  const steps = ref<PipelineStep[]>([]);
  const episodes = ref<PipelineEpisode[]>([]);
  const score = ref<PipelineScore | null>(null);
  const versions = ref<PipelineVersionSummary[]>([]);
  const selectedVersion = ref<PipelineVersionDetail | null>(null);
  const compareBaseVersion = ref<PipelineVersionDetail | null>(null);
  const compareTargetVersion = ref<PipelineVersionDetail | null>(null);
  const loading = ref(false);
  const generating = ref(false);
  const versioning = ref(false);
  const error = ref<string | null>(null);
  const errorLogs = ref<{ step: number; stepName: string; message: string; timestamp: string }[]>([]);
  const realtimeLogs = ref<PipelineRealtimeLog[]>([]);

  // SSE
  const eventSource = ref<EventSource | null>(null);
  const streamConnected = ref(false);
  const latestLog = ref('');

  // Computed
  const currentStepLabel = computed(() => {
    if (!currentTask.value) return '';
    const currentStep = currentTask.value.current_step;
    const stepName = steps.value.find(
      s => s.step_number === currentStep
    )?.step_name;
    return STEP_LABELS[stepName || ''] || stepName || '';
  });

  const progressPercent = computed(() => {
    if (!currentTask.value) return 0;
    const stepProgress = (currentTask.value.current_step / 8) * 40;
    const episodeProgress = currentTask.value.total_episodes > 0
      ? (currentTask.value.completed_episodes / currentTask.value.total_episodes) * 60
      : 0;
    return Math.round(stepProgress + episodeProgress);
  });

  const isRunning = computed(() =>
    currentTask.value?.status === 'running'
  );

  const isPaused = computed(() =>
    currentTask.value?.status === 'paused'
  );

  const isCompleted = computed(() =>
    currentTask.value?.status === 'completed'
  );

  function patchCurrentTask(patch: Partial<PipelineTask>) {
    if (!currentTask.value) return;
    currentTask.value = {
      ...currentTask.value,
      ...patch,
    };
  }

  // Actions
  async function startPipeline(params: {
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
    total_episodes: number;
  }) {
    generating.value = true;
    error.value = null;

    try {
      const response = await apiService.startPipeline(params);
      if (response.success && response.data?.taskId) {
        // 获取初始状态
        await fetchStatus(response.data.taskId);
        // 连接SSE
        connectToStream(response.data.taskId);
        return response.data.taskId;
      }
      throw new Error(response.error || '启动失败');
    } catch (err: any) {
      error.value = err.message;
      generating.value = false;
      throw err;
    }
  }

  async function fetchStatus(taskId: string) {
    loading.value = true;
    try {
      const response = await apiService.getPipelineStatus(taskId);
      if (response.success && response.data) {
        currentTask.value = response.data.task;
        steps.value = response.data.steps || [];
        episodes.value = (response.data.episodes || []).map((ep: any) => ({
          episode_number: ep.episode_number,
          title: ep.title,
          status: ep.status,
          word_count: ep.word_count,
          summary: ep.summary,
        }));
        score.value = response.data.score || null;
        await fetchLogs(taskId);
      }
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchEpisode(taskId: string, episodeNumber: number): Promise<any> {
    try {
      const response = await apiService.getPipelineEpisode(taskId, episodeNumber);
      if (response.success && response.data?.episode) {
        return response.data.episode;
      }
      throw new Error('获取集数失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function pausePipeline(taskId: string) {
    try {
      const response = await apiService.pausePipeline(taskId);
      if (response.success) {
        patchCurrentTask({ status: 'paused' });
      }
      return response;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function resumePipeline(taskId: string, payload?: { ai_service?: string; ai_model?: string }) {
    try {
      const response = await apiService.resumePipeline(taskId, payload);
      if (response.success) {
        patchCurrentTask({
          status: 'running',
          ai_service: response.data?.ai_service || payload?.ai_service || currentTask.value?.ai_service || 'cloudflare-ai',
          ai_model: response.data?.ai_model || payload?.ai_model || currentTask.value?.ai_model || null,
        });
        connectToStream(taskId);
      }
      return response;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function cancelPipeline(taskId: string) {
    try {
      const response = await apiService.cancelPipeline(taskId);
      if (response.success) {
        closeStream();
        patchCurrentTask({ status: 'failed' });
        generating.value = false;
      }
      return response;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function exportScript(taskId: string): Promise<string> {
    try {
      // Use fetch directly for file download
      const token = localStorage.getItem('auth_token');
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8787';
      const response = await fetch(
        `${API_BASE}/api/pipeline/${taskId}/export?format=markdown`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!response.ok) {
        throw new Error('导出失败');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      // Get filename from Content-Disposition
      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="?(.+?)"?$/);
      a.download = filenameMatch ? decodeURIComponent(filenameMatch[1]) : 'script.md';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      return a.download;
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  function connectToStream(taskId: string) {
    closeStream();

    eventSource.value = connectSSE(taskId, {
      onStatus: (data) => {
        patchCurrentTask(data);
        streamConnected.value = true;
      },
      onProgress: (data: SSEProgressEvent) => {
        patchCurrentTask({
          status: data.status,
          current_step: data.currentStep,
          completed_episodes: data.completedEpisodes,
        });
        latestLog.value = `${data.stepName} - 第${data.completedEpisodes}/${data.totalEpisodes}集`;
      },
      onLog: (data: SSELogEvent) => {
        if (!realtimeLogs.value.some((log) => log.id === data.id)) {
          realtimeLogs.value.push(data);
        }
        latestLog.value = data.message;
      },
      onEpisode: (data: SSEEpisodeEvent) => {
        // 更新集数列表
        const existing = episodes.value.find(
          e => e.episode_number === data.episodeNumber
        );
        if (existing) {
          existing.status = 'completed';
          existing.title = data.title;
        } else {
          episodes.value.push({
            episode_number: data.episodeNumber,
            title: data.title,
            status: 'completed',
            word_count: 0,
          });
        }
      },
      onDone: (data: SSEDoneEvent) => {
        patchCurrentTask({ status: data.status });
        generating.value = false;
        streamConnected.value = false;
        fetchStatus(taskId);
      },
      onError: (data) => {
        if (data.message) {
          errorLogs.value.push({
            step: data.step || 0,
            stepName: data.stepName || 'unknown',
            message: data.message,
            timestamp: data.timestamp || new Date().toISOString(),
          });
        }
      },
    });
  }

  function closeStream() {
    closeSSE(eventSource.value);
    eventSource.value = null;
    streamConnected.value = false;
  }

  async function fetchTaskList(page = 1, limit = 10) {
    loading.value = true;
    try {
      const response = await apiService.getPipelineList(page, limit);
      if (response.success && response.data) {
        tasks.value = response.data.tasks;
      }
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchSteps(taskId: string) {
    try {
      const response = await apiService.getPipelineSteps(taskId);
      if (response.success && response.data?.steps) {
        steps.value = response.data.steps;
      }
    } catch (err: any) {
      error.value = err.message;
    }
  }

  async function fetchLogs(taskId: string) {
    try {
      const response = await apiService.getPipelineLogs(taskId);
      if (response.success && response.data?.logs) {
        realtimeLogs.value = response.data.logs.map((log: any) => ({
          id: log.id,
          taskId: log.task_id,
          level: log.level,
          step: log.step_number ?? undefined,
          stepName: log.step_name ?? undefined,
          episodeNumber: log.episode_number ?? undefined,
          message: log.message,
          detail: log.detail ?? undefined,
          timestamp: log.created_at,
        }));
      }
    } catch (err: any) {
      error.value = err.message;
    }
  }

  async function fetchStepContent(taskId: string, stepNumber: number): Promise<any> {
    try {
      const response = await apiService.getPipelineStepContent(taskId, stepNumber);
      if (response.success && response.data) {
        return response.data;
      }
      throw new Error('获取步骤内容失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    }
  }

  async function fetchVersions(taskId: string) {
    versioning.value = true;
    try {
      const response = await apiService.getPipelineVersions(taskId);
      if (response.success && response.data?.versions) {
        versions.value = response.data.versions;
      }
      return response.data?.versions || [];
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      versioning.value = false;
    }
  }

  async function fetchVersionDetail(taskId: string, versionId: number) {
    versioning.value = true;
    try {
      const response = await apiService.getPipelineVersionDetail(taskId, versionId);
      if (response.success && response.data?.version) {
        selectedVersion.value = response.data.version;
        return response.data.version;
      }
      throw new Error('获取版本详情失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      versioning.value = false;
    }
  }

  async function loadVersionForCompare(taskId: string, versionId: number, slot: 'base' | 'target') {
    versioning.value = true;
    try {
      const response = await apiService.getPipelineVersionDetail(taskId, versionId);
      if (response.success && response.data?.version) {
        if (slot === 'base') {
          compareBaseVersion.value = response.data.version;
        } else {
          compareTargetVersion.value = response.data.version;
        }
        return response.data.version;
      }
      throw new Error('获取版本详情失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      versioning.value = false;
    }
  }

  async function createVersion(taskId: string, payload: { label?: string; changeNotes?: string }) {
    versioning.value = true;
    try {
      const response = await apiService.createPipelineVersion(taskId, payload);
      if (response.success && response.data?.version) {
        versions.value = [response.data.version, ...versions.value];
        selectedVersion.value = response.data.version;
        return response.data.version;
      }
      throw new Error(response.error || '创建版本失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      versioning.value = false;
    }
  }

  async function branchVersion(taskId: string, versionId: number, payload: { label?: string; changeNotes?: string }) {
    versioning.value = true;
    try {
      const response = await apiService.branchPipelineVersion(taskId, versionId, payload);
      if (response.success && response.data?.version) {
        versions.value = [response.data.version, ...versions.value];
        selectedVersion.value = response.data.version;
        return response.data.version;
      }
      throw new Error(response.error || '派生版本失败');
    } catch (err: any) {
      error.value = err.message;
      throw err;
    } finally {
      versioning.value = false;
    }
  }

  function clearCurrentTask() {
    closeStream();
    currentTask.value = null;
    steps.value = [];
    episodes.value = [];
    score.value = null;
    versions.value = [];
    selectedVersion.value = null;
    compareBaseVersion.value = null;
    compareTargetVersion.value = null;
    generating.value = false;
    versioning.value = false;
    error.value = null;
    errorLogs.value = [];
    realtimeLogs.value = [];
  }

  return {
    // State
    tasks,
    currentTask,
    steps,
    episodes,
    score,
    versions,
    selectedVersion,
    compareBaseVersion,
    compareTargetVersion,
    loading,
    generating,
    versioning,
    error,
    errorLogs,
    realtimeLogs,
    streamConnected,
    latestLog,
    // Computed
    currentStepLabel,
    progressPercent,
    isRunning,
    isPaused,
    isCompleted,
    // Actions
    startPipeline,
    fetchStatus,
    fetchEpisode,
    fetchSteps,
    fetchStepContent,
    fetchLogs,
    fetchVersions,
    fetchVersionDetail,
    loadVersionForCompare,
    createVersion,
    branchVersion,
    pausePipeline,
    resumePipeline,
    cancelPipeline,
    exportScript,
    connectToStream,
    closeStream,
    fetchTaskList,
    clearCurrentTask,
  };
});
