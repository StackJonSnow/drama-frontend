<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePipelineStore } from '@/stores/pipeline';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import type { AIConfig, AIService, ScriptType } from '@/types';
import { GENRE_OPTIONS, SCRIPT_TYPE_OPTIONS } from '@/types';

const router = useRouter();
const pipelineStore = usePipelineStore();
const toast = useToast();

const formData = ref({
  title: '', genre: '', script_type: 'tv' as ScriptType,
  style: '', target_platform: '', target_duration: 60,
  character_count: 5, key_points: [] as string[],
  characters_input: [] as string[], scene_input: '',
  ai_service: 'cloudflare-ai', workflow_template_id: undefined as number | undefined, total_episodes: 50,
});

const newCharacter = ref('');
const newKeyPoint = ref('');
const autofilling = ref(false);
const autofillMode = ref<'conservative' | 'balanced' | 'wild'>('balanced');
const autofillPolicy = ref<'overwrite' | 'fill-empty'>('overwrite');
const loadingTask = ref(false);
const hasExistingTask = ref(false);
const availableServices = ref<AIService[]>([]);
const configuredServices = ref<AIConfig[]>([]);
const workflowTemplates = ref<any[]>([]);
const loadingServices = ref(true);
const resumeService = ref('cloudflare-ai');
const resumeModel = ref('');
const currentTaskServiceMeta = computed<any>(() => null);
const currentTaskServiceConfig = computed<any>(() => null);
const resumeServiceMeta = computed<any>(() => null);
const resumeUsableServices = computed<any[]>(() => []);
const resumeModelSuggestions = computed(() => [] as string[]);
const previewStep = ref<number | null>(null);
const stepPreviewContent = ref<any>(null);
const stepPreviewSummary = ref('');
const STEP_LABELS: Record<string, string> = {
  story_outline: '故事大纲', characters: '角色设定', plot_structure: '剧情结构',
  episode_plan: '集数计划', scenes: '场景生成', dialogue: '对白生成',
  compose: '剧本合成', evaluate: '剧本评分',
};
const visibleLogs = computed(() => [] as Array<{ id: number; time: string; type: string; message: string; detail?: string }>);
const logFilter = ref<'all' | 'summary'>('all');
const logs = ref<any[]>([]);
const logPanelRef = ref<HTMLElement | null>(null);

function isTaskStepPaused(_: { status: string }) { return false; }
function isActiveTaskStep(_: { status: string; step_number: number }) { return false; }
function getActiveTaskModelLabel() { return '默认模型'; }
function getStepElapsedLabel(_: any) { return ''; }
function getStepLatestAIMetrics(_: number) { return null; }
function getStepLatestAIMetricsLabel(_: number) { return ''; }
function getStepSummaryPreview(_: any) { return ''; }
function handlePause() { return Promise.resolve(); }
function handleResume() { return Promise.resolve(); }
function handleCancel() { return Promise.resolve(); }
function handleExport() { return Promise.resolve(); }
function viewStepPreview(_: number) { return Promise.resolve(); }
function isSummaryLog(_: { message: string }) { return false; }
function shouldCollapseDetail(detail?: string) { return Boolean(detail && detail.length > 700); }
function getVisibleDetail(log: { detail?: string }) { return log.detail || ''; }
function isLogExpanded(_: number) { return false; }
function toggleLogExpanded(_: number) {}

const usableServices = computed(() => {
  return availableServices.value.filter((service) => {
    if (service.id === 'cloudflare-ai') return true;
    const config = configuredServices.value.find((item) => item.service_name === service.id);
    return config?.validation_status === 'passed';
  });
});

const selectedServiceMeta = computed(() =>
  availableServices.value.find((service) => service.id === formData.value.ai_service),
);

const selectedServiceConfig = computed(() =>
  configuredServices.value.find((item) => item.service_name === formData.value.ai_service),
);


async function loadServices() {
  loadingServices.value = true;

  try {
    const [servicesResponse, configResponse, workflowResponse] = await Promise.all([
      apiService.getAIServices(),
      apiService.getAIConfig(),
      apiService.getWorkflowTemplates(),
    ]);

    availableServices.value = servicesResponse.data?.services || [];
    configuredServices.value = configResponse.data?.configs || [];
    workflowTemplates.value = workflowResponse.data?.templates || [];

    if (!formData.value.workflow_template_id && workflowTemplates.value.length) {
      formData.value.workflow_template_id = workflowTemplates.value.find((item) => item.is_default)?.id || workflowTemplates.value[0]?.id;
    }

    if (!usableServices.value.find((service) => service.id === formData.value.ai_service)) {
      formData.value.ai_service = usableServices.value[0]?.id || 'cloudflare-ai';
    }
  } catch (error: any) {
    toast.error(error.message || '加载模型渠道失败');
  } finally {
    loadingServices.value = false;
  }
}

onMounted(async () => {
  await loadServices();
});

function addCharacter() {
  if (newCharacter.value.trim() && !formData.value.characters_input.includes(newCharacter.value.trim())) {
    formData.value.characters_input.push(newCharacter.value.trim());
    newCharacter.value = '';
  }
}
function removeCharacter(i: number) { formData.value.characters_input.splice(i, 1); }
function addKeyPoint() {
  if (newKeyPoint.value.trim() && !formData.value.key_points.includes(newKeyPoint.value.trim())) {
    formData.value.key_points.push(newKeyPoint.value.trim());
    newKeyPoint.value = '';
  }
}
function removeKeyPoint(i: number) { formData.value.key_points.splice(i, 1); }

async function startPipeline() {
  if (!formData.value.title || !formData.value.genre) { toast.error('请填写标题和题材'); return; }
  if (!usableServices.value.find((service) => service.id === formData.value.ai_service)) {
    toast.error('所选渠道尚未通过检测，请先前往设置页完成检测');
    return;
  }
  try {
    const taskId = await pipelineStore.startPipeline({
      title: formData.value.title, genre: formData.value.genre,
      script_type: formData.value.script_type, style: formData.value.style || undefined,
      target_platform: formData.value.target_platform || undefined,
      target_duration: formData.value.target_duration,
      character_count: formData.value.character_count,
      key_points: formData.value.key_points.length ? formData.value.key_points : undefined,
      characters_input: formData.value.characters_input.length ? formData.value.characters_input : undefined,
      scene_input: formData.value.scene_input || undefined,
      ai_service: formData.value.ai_service, workflow_template_id: formData.value.workflow_template_id, total_episodes: formData.value.total_episodes,
    });
    router.push(`/pipeline/${taskId}/editor`);
  } catch (error: any) {
    toast.error(error.message);
  }
}

async function autofillWithAI() {
  if (!formData.value.genre || !formData.value.script_type) {
    toast.error('请先选择题材和类型');
    return;
  }

  if (!usableServices.value.find((service) => service.id === formData.value.ai_service)) {
    toast.error('所选渠道尚未通过检测，请先前往设置页完成检测');
    return;
  }

  autofilling.value = true;
  try {
    const response = await apiService.autofillProjectParams({
      genre: formData.value.genre,
      script_type: formData.value.script_type,
      ai_service: formData.value.ai_service,
      generation_mode: autofillMode.value,
    });
    const suggestion = response.data?.suggestion || {};

    const normalizeStringArray = (value: unknown): string[] => {
      if (!Array.isArray(value)) return [];
      return value
        .map((item) => {
          if (typeof item === 'string') return item.trim();
          if (item && typeof item === 'object') {
            const objectValue = item as Record<string, unknown>;
            return [objectValue.name, objectValue.role, objectValue.identity, objectValue.goal, objectValue.conflict]
              .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
              .join('｜')
              .trim();
          }
          return String(item || '').trim();
        })
        .filter(Boolean);
    };

    const pickValue = <T>(currentValue: T, nextValue: T) => {
      if (autofillPolicy.value === 'overwrite') return nextValue;
      const isEmptyArray = Array.isArray(currentValue) && currentValue.length === 0;
      const isEmptyString = typeof currentValue === 'string' && !currentValue.trim();
      const isEmptyNumber = typeof currentValue === 'number' && (!currentValue || Number.isNaN(currentValue));
      if (isEmptyArray || isEmptyString || isEmptyNumber) {
        return nextValue;
      }
      return currentValue;
    };

    formData.value = {
      ...formData.value,
      title: pickValue(formData.value.title, suggestion.title || formData.value.title),
      style: pickValue(formData.value.style, suggestion.style || formData.value.style),
      target_platform: pickValue(formData.value.target_platform, suggestion.target_platform || formData.value.target_platform),
      target_duration: Number(pickValue(formData.value.target_duration, Number(suggestion.target_duration || formData.value.target_duration || 60))),
      total_episodes: Number(pickValue(formData.value.total_episodes, Number(suggestion.total_episodes || formData.value.total_episodes || 50))),
      character_count: Number(pickValue(formData.value.character_count, Number(suggestion.character_count || formData.value.character_count || 5))),
      key_points: Array.isArray(suggestion.key_points) ? pickValue(formData.value.key_points, normalizeStringArray(suggestion.key_points)) : formData.value.key_points,
      characters_input: Array.isArray(suggestion.characters_input) ? pickValue(formData.value.characters_input, normalizeStringArray(suggestion.characters_input)) : formData.value.characters_input,
      scene_input: pickValue(formData.value.scene_input, suggestion.scene_input || formData.value.scene_input),
    };

    toast.success(autofillPolicy.value === 'overwrite' ? 'AI 已覆盖填充创作参数，可继续生成或再次重试' : 'AI 已补全空白创作参数');
  } catch (error: any) {
    toast.error(error.message || '智能填充失败');
  } finally {
    autofilling.value = false;
  }
}

function startNew() {
  pipelineStore.clearCurrentTask();
  formData.value = {
    title: '', genre: '', script_type: 'tv', style: '', target_platform: '',
    target_duration: 60, character_count: 5, key_points: [], characters_input: [],
    scene_input: '', ai_service: 'cloudflare-ai', workflow_template_id: workflowTemplates.value.find((item) => item.is_default)?.id || workflowTemplates.value[0]?.id, total_episodes: 50,
  };
  if (!usableServices.value.find((service) => service.id === formData.value.ai_service)) {
    formData.value.ai_service = usableServices.value[0]?.id || 'cloudflare-ai';
  }
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Loading task -->
    <template v-if="loadingTask">
      <div class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB] mx-auto mb-3"></div>
          <p class="text-sm text-[#737373]">加载任务中...</p>
        </div>
      </div>
    </template>

    <!-- No task: Show form in full width -->
    <template v-else-if="!hasExistingTask">
      <div class="flex-1 overflow-auto p-6">
        <div class="max-w-2xl mx-auto">
          <div class="mb-6">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-2">New Project / Writer's Room Intake</div>
            <h1 class="text-2xl font-semibold text-white mb-2">创建新项目</h1>
            <p class="text-sm text-[#737373]">先定义项目创意、生产策略和模型配置，再进入统一工作台持续生成与改稿。</p>
          </div>

          <div class="grid md:grid-cols-3 gap-3 mb-6">
            <div class="card !p-4">
              <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">创意输入</div>
              <div class="text-sm text-white">标题、题材、角色、关键情节点</div>
            </div>
            <div class="card !p-4">
              <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">生产策略</div>
              <div class="text-sm text-white">工作流模板、集数、风格与平台</div>
            </div>
            <div class="card !p-4">
              <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">AI 执行</div>
              <div class="text-sm text-white">模型渠道、运行日志、暂停恢复</div>
            </div>
          </div>

          <div class="rounded-2xl border border-[#2563EB]/20 bg-[#2563EB]/5 p-4 mb-6">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div class="text-sm font-medium text-white mb-1">AI 智能填充创作参数</div>
                <div class="text-xs text-[#93C5FD] leading-6">只需先选择题材和类型，即可由 AI 自动生成标题、风格、平台、角色、关键情节点和背景设定。支持多次生成、覆盖填充或仅补全空白字段。</div>
              </div>
              <button type="button" @click="autofillWithAI" :disabled="autofilling || !formData.genre || !formData.script_type" class="btn-secondary whitespace-nowrap">
                {{ autofilling ? '智能生成中...' : 'AI 智能填充' }}
              </button>
            </div>
            <div class="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div class="flex flex-wrap gap-2">
                <button type="button" @click="autofillMode = 'conservative'" :class="autofillMode === 'conservative' ? 'px-3 py-1.5 rounded-full bg-white text-black text-xs font-medium' : 'px-3 py-1.5 rounded-full border border-[#3B82F6]/30 text-xs text-[#BFDBFE] hover:border-[#60A5FA]'">保守</button>
                <button type="button" @click="autofillMode = 'balanced'" :class="autofillMode === 'balanced' ? 'px-3 py-1.5 rounded-full bg-[#2563EB] text-white text-xs font-medium' : 'px-3 py-1.5 rounded-full border border-[#3B82F6]/30 text-xs text-[#BFDBFE] hover:border-[#60A5FA]'">平衡</button>
                <button type="button" @click="autofillMode = 'wild'" :class="autofillMode === 'wild' ? 'px-3 py-1.5 rounded-full bg-fuchsia-500 text-white text-xs font-medium' : 'px-3 py-1.5 rounded-full border border-fuchsia-400/30 text-xs text-fuchsia-200 hover:border-fuchsia-300'">脑洞大</button>
              </div>
              <div class="flex items-center gap-3 text-xs text-[#BFDBFE]">
                <label class="inline-flex items-center gap-2">
                  <input type="radio" v-model="autofillPolicy" value="overwrite" />
                  覆盖填充
                </label>
                <label class="inline-flex items-center gap-2">
                  <input type="radio" v-model="autofillPolicy" value="fill-empty" />
                  只填空字段
                </label>
              </div>
            </div>
          </div>

          <form @submit.prevent="startPipeline" class="space-y-4">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#666]">项目概述</div>
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">标题 *</label>
              <input v-model="formData.title" type="text" required class="input-field" placeholder="输入剧本标题" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">题材 *</label>
                <select v-model="formData.genre" required class="input-field">
                  <option value="">选择题材</option>
                  <option v-for="opt in GENRE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">类型 *</label>
                <select v-model="formData.script_type" required class="input-field">
                  <option v-for="opt in SCRIPT_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">总集数</label>
                <input v-model.number="formData.total_episodes" type="number" min="50" max="200" class="input-field" />
              </div>
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">角色数量</label>
                <input v-model.number="formData.character_count" type="number" min="2" max="30" class="input-field" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">风格</label>
                <input v-model="formData.style" type="text" class="input-field" placeholder="如：轻松幽默" />
              </div>
              <div>
                <label class="block text-xs text-[#A3A3A3] mb-1.5">目标平台</label>
                <input v-model="formData.target_platform" type="text" class="input-field" placeholder="如：优酷" />
              </div>
            </div>
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] pt-2">生产配置</div>
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">工作流模板</label>
              <select v-model="formData.workflow_template_id" class="input-field">
                <option v-for="template in workflowTemplates" :key="template.id" :value="template.id">
                  {{ template.name }}{{ template.is_default ? '（默认）' : '' }}
                </option>
              </select>
              <div class="mt-1 text-[11px] text-[#737373]">流程编排、节点元信息与执行顺序由所选模板决定，可在「工作流」页维护。</div>
            </div>
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">背景描述</label>
              <textarea v-model="formData.scene_input" rows="2" class="input-field" placeholder="故事发生的地点、时代背景等"></textarea>
            </div>

            <!-- Characters -->
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] pt-2">创意要素</div>
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">指定角色</label>
              <div class="flex gap-2">
                <input v-model="newCharacter" type="text" class="input-field flex-1" placeholder="角色名称" @keyup.enter.prevent="addCharacter" />
                <button type="button" @click="addCharacter" class="btn-secondary">添加</button>
              </div>
              <div v-if="formData.characters_input.length" class="flex flex-wrap gap-1.5 mt-2">
                <span v-for="(c, i) in formData.characters_input" :key="i" class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-[#2F2F2F] text-[#D4D4D4]">
                  {{ c }}
                  <button type="button" @click="removeCharacter(i)" class="ml-1 text-[#737373] hover:text-red-400">&times;</button>
                </span>
              </div>
            </div>

            <!-- Key points -->
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">关键情节点</label>
              <div class="flex gap-2">
                <input v-model="newKeyPoint" type="text" class="input-field flex-1" placeholder="关键情节或转折点" @keyup.enter.prevent="addKeyPoint" />
                <button type="button" @click="addKeyPoint" class="btn-secondary">添加</button>
              </div>
              <div v-if="formData.key_points.length" class="space-y-1 mt-2">
                <div v-for="(p, i) in formData.key_points" :key="i" class="flex items-center justify-between px-3 py-1.5 rounded bg-[#2F2F2F] text-sm text-[#D4D4D4]">
                  <span>{{ i + 1 }}. {{ p }}</span>
                  <button type="button" @click="removeKeyPoint(i)" class="text-[#737373] hover:text-red-400">&times;</button>
                </div>
              </div>
            </div>

            <!-- AI service -->
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] pt-2">AI 执行配置</div>
            <div>
              <div class="flex items-center justify-between gap-3 mb-1.5">
                <label class="block text-xs text-[#A3A3A3]">AI服务</label>
                <RouterLink to="/settings" class="text-[11px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors">管理渠道</RouterLink>
              </div>
              <div v-if="loadingServices" class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-4 text-sm text-[#737373]">
                正在加载可用渠道...
              </div>
              <div v-else class="space-y-3">
                <div class="grid grid-cols-2 gap-2">
                <button v-for="s in usableServices" :key="s.id"
                  type="button" @click="formData.ai_service = s.id"
                  :class="['px-3 py-3 rounded-xl text-sm text-left transition-colors border', formData.ai_service === s.id ? 'bg-[#2563EB]/10 text-[#60A5FA] border-[#2563EB]/50' : 'bg-[#2F2F2F] text-[#A3A3A3] border-[#404040] hover:border-[#555]']">
                  <div class="font-medium">{{ s.name }}</div>
                  <div class="text-[11px] mt-1 opacity-80">{{ s.protocol === 'openai-compatible' ? '已检测后可用' : s.protocol === 'anthropic' ? '官方接口' : '默认可用' }}</div>
                </button>
                </div>
                <div v-if="selectedServiceMeta" class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-3 text-xs text-[#A3A3A3] leading-6">
                  <div class="flex items-center justify-between gap-4">
                    <span>{{ selectedServiceMeta.description }}</span>
                    <span v-if="selectedServiceConfig?.validation_status === 'passed'" class="px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">检测通过</span>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" :disabled="pipelineStore.generating" class="btn-primary w-full mt-2">
              {{ pipelineStore.generating ? '生成中...' : '开始生成剧本' }}
            </button>
          </form>
        </div>
      </div>
    </template>

    <!-- Has task: Split layout -->
    <template v-else>
      <div class="flex-1 flex overflow-hidden">
        <!-- Left panel: Step progress + controls -->
        <div class="w-[320px] flex-shrink-0 border-r border-[#2F2F2F] flex flex-col overflow-hidden">
          <!-- Task header -->
          <div class="px-4 py-3 border-b border-[#2F2F2F]">
            <div class="text-sm font-medium text-white truncate">{{ pipelineStore.currentTask?.title }}</div>
            <div class="flex items-center gap-2 mt-1">
              <span :class="[
                'inline-block w-2 h-2 rounded-full',
                pipelineStore.currentTask?.status === 'running' ? 'bg-green-500 animate-pulse' :
                pipelineStore.currentTask?.status === 'completed' ? 'bg-blue-500' :
                pipelineStore.currentTask?.status === 'paused' ? 'bg-yellow-500' : 'bg-red-500'
              ]"></span>
              <span class="text-xs text-[#A3A3A3]">
                {{ pipelineStore.currentTask?.status === 'running' ? '生成中' : pipelineStore.currentTask?.status === 'completed' ? '已完成' : pipelineStore.currentTask?.status === 'paused' ? '已暂停' : '已失败' }}
              </span>
              <span class="text-xs text-[#737373] ml-auto">
                {{ pipelineStore.currentTask?.completed_episodes }}/{{ pipelineStore.currentTask?.total_episodes }}集
              </span>
            </div>
            <div class="mt-2 flex flex-wrap gap-2 text-[11px]">
              <span class="px-2 py-0.5 rounded-full bg-[#2563EB]/10 text-[#93C5FD] border border-[#2563EB]/20">
                渠道：{{ currentTaskServiceMeta?.name || pipelineStore.currentTask?.ai_service || 'cloudflare-ai' }}
              </span>
              <span class="px-2 py-0.5 rounded-full bg-white/5 text-[#D4D4D4] border border-white/10">
                模型：{{ pipelineStore.currentTask?.ai_model || currentTaskServiceConfig?.model || currentTaskServiceMeta?.defaultModel || '默认模型' }}
              </span>
            </div>
            <!-- Progress bar -->
            <div class="mt-2 h-1 bg-[#2F2F2F] rounded-full overflow-hidden">
              <div class="h-full bg-[#2563EB] rounded-full transition-all duration-500" :style="{ width: `${pipelineStore.progressPercent}%` }"></div>
            </div>
          </div>

          <!-- Steps list -->
          <div class="flex-1 overflow-auto py-1">
            <div v-for="step in (pipelineStore.steps.length ? pipelineStore.steps : [1,2,3,4,5,6,7,8].map(n => ({step_number:n, step_name:['','story_outline','characters','plot_structure','episode_plan','scenes','dialogue','compose','evaluate'][n], status:'pending', error_message:'', current_task_summary: null})))"
              :key="step.step_number"
              @click="step.status === 'completed' ? viewStepPreview(step.step_number) : null"
              :class="[
                'mx-2 px-3 py-2 rounded-md mb-0.5 transition-colors',
                step.status === 'completed' ? 'cursor-pointer hover:bg-[#2F2F2F]' : '',
                previewStep === step.step_number ? 'bg-[#2F2F2F]' : ''
              ]">
              <div class="flex items-center gap-2.5">
                <div class="relative">
                <div :class="[
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium flex-shrink-0 relative z-10',
                  step.status === 'completed' ? 'bg-[#2563EB] text-white' :
                  isTaskStepPaused(step) ? 'bg-yellow-500/20 text-yellow-300' :
                  step.status === 'running' ? 'bg-[#2563EB]/20 text-[#60A5FA]' :
                  step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-[#2F2F2F] text-[#737373]'
                ]">
                  <svg v-if="step.status === 'completed'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                  <svg v-else-if="isTaskStepPaused(step)" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M6 4h3v12H6zM11 4h3v12h-3z" /></svg>
                  <span v-else-if="step.status === 'running'" class="inline-flex gap-[2px] items-center">
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:120ms]"></span>
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:240ms]"></span>
                  </span>
                  <span v-else>{{ step.step_number }}</span>
                </div>
                <span v-if="step.status === 'running' && !isTaskStepPaused(step)" class="absolute inset-0 rounded-full border border-[#60A5FA]/40 animate-ping"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-[#D4D4D4]">{{ STEP_LABELS[step.step_name] || step.step_name }}</div>
                  <div v-if="isActiveTaskStep(step)" class="mt-1 inline-flex max-w-full rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-[#CFCFCF] truncate">
                    模型：{{ getActiveTaskModelLabel() }}
                  </div>
                  <div v-if="getStepElapsedLabel(step)" class="text-[10px] text-[#8A8A8A] mt-0.5">
                    耗时：{{ getStepElapsedLabel(step) }}
                  </div>
                  <div v-if="getStepLatestAIMetrics(step.step_number)" class="text-[10px] text-[#7DD3FC] mt-0.5">
                    最近AI：{{ getStepLatestAIMetricsLabel(step.step_number) }}
                  </div>
                  <div v-if="step.current_task_summary" class="text-[10px] text-[#A78BFA] mt-0.5 truncate">
                    摘要：{{ getStepSummaryPreview(step) }}
                  </div>
                  <div v-if="isTaskStepPaused(step)" class="text-[10px] text-yellow-300 mt-0.5">已暂停</div>
                  <div v-else-if="step.status === 'running'" class="text-[10px] text-[#60A5FA] mt-0.5">执行中...</div>
                  <div v-if="step.error_message" class="text-[10px] text-red-400 truncate">{{ step.error_message }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="px-3 py-2 border-t border-[#2F2F2F] space-y-3">
            <div v-if="pipelineStore.isPaused" class="space-y-2 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5">
              <div class="text-[11px] text-yellow-200">恢复执行前可切换模型，默认使用任务启动时的模型。</div>
              <div class="space-y-2">
                <select v-model="resumeService" class="w-full rounded-md border border-[#3A3A3A] bg-[#191919] px-2.5 py-2 text-xs text-white">
                  <option v-for="service in resumeUsableServices" :key="service.id" :value="service.id">{{ service.name }}</option>
                </select>
                <input v-model="resumeModel" list="generate-resume-models" type="text" class="w-full rounded-md border border-[#3A3A3A] bg-[#191919] px-2.5 py-2 text-xs text-white" :placeholder="resumeServiceMeta?.defaultModel || '输入模型名称'" />
                <datalist id="generate-resume-models">
                  <option v-for="modelOption in resumeModelSuggestions" :key="modelOption" :value="modelOption"></option>
                </datalist>
                <div v-if="resumeModelSuggestions.length" class="flex flex-wrap gap-1.5">
                  <button v-for="modelOption in resumeModelSuggestions" :key="modelOption" type="button" @click="resumeModel = modelOption" class="px-2 py-0.5 rounded-full border border-[#3A3A3A] text-[10px] text-[#D4D4D4] hover:border-[#60A5FA] hover:text-[#93C5FD] transition-colors">
                    {{ modelOption }}
                  </button>
                </div>
              </div>
            </div>
            <div class="flex gap-2">
            <button v-if="pipelineStore.isRunning" @click="handlePause" class="btn-secondary flex-1 text-xs py-1.5">暂停</button>
            <button v-if="pipelineStore.isPaused" @click="handleResume" class="btn-primary flex-1 text-xs py-1.5">恢复</button>
            <button v-if="pipelineStore.isRunning || pipelineStore.isPaused" @click="handleCancel" class="btn-secondary flex-1 text-xs py-1.5 text-red-400">取消</button>
            <button v-if="pipelineStore.isCompleted" @click="handleExport" class="btn-primary flex-1 text-xs py-1.5">导出Markdown</button>
            <button v-if="pipelineStore.isCompleted || pipelineStore.currentTask?.status === 'failed'" @click="startNew" class="btn-ghost flex-1 text-xs py-1.5">新建</button>
            </div>
          </div>
        </div>

        <!-- Right panel: Step preview + Log -->
        <div class="flex-1 flex flex-col overflow-hidden">
          <!-- Step preview area -->
          <div class="flex-1 overflow-auto p-6">
            <template v-if="previewStep && stepPreviewContent">
              <div class="max-w-3xl">
                <div class="flex items-center gap-2 mb-4">
                  <span class="text-xs px-2 py-0.5 rounded bg-[#2563EB]/10 text-[#60A5FA]">Step {{ previewStep }}</span>
                  <h2 class="text-lg font-semibold text-white">{{ STEP_LABELS[pipelineStore.steps.find(s => s.step_number === previewStep)?.step_name || ''] }}</h2>
                </div>
                <div v-if="stepPreviewSummary" class="card mb-4 border border-[#8B5CF6]/20 bg-[#8B5CF6]/5">
                  <div class="text-sm text-[#C4B5FD] mb-2">当前任务摘要</div>
                  <div class="text-sm text-[#D4D4D4] whitespace-pre-wrap leading-relaxed">{{ stepPreviewSummary }}</div>
                </div>
                <div class="card">
                  <pre class="text-sm text-[#D4D4D4] whitespace-pre-wrap font-sans leading-relaxed">{{ JSON.stringify(stepPreviewContent, null, 2) }}</pre>
                </div>
              </div>
            </template>
            <template v-else-if="pipelineStore.isCompleted && pipelineStore.score">
              <div class="max-w-3xl">
                <h2 class="text-lg font-semibold text-white mb-4">生成完成</h2>
                <div class="card mb-4">
                  <div class="text-sm text-[#A3A3A3] mb-3">剧本评分</div>
                  <div class="grid grid-cols-5 gap-3">
                    <div v-for="(label, key) in { plot_score: '剧情', dialogue_score: '对白', character_score: '人物', pacing_score: '节奏', creativity_score: '创意' }" :key="key" class="text-center">
                      <div class="text-2xl font-semibold" :class="(pipelineStore.score[key as keyof typeof pipelineStore.score] as number) >= 7 ? 'text-green-400' : (pipelineStore.score[key as keyof typeof pipelineStore.score] as number) >= 5 ? 'text-yellow-400' : 'text-red-400'">
                        {{ pipelineStore.score[key as keyof typeof pipelineStore.score] }}
                      </div>
                      <div class="text-[10px] text-[#737373] mt-0.5">{{ label }}</div>
                    </div>
                  </div>
                  <div class="mt-3 text-center">
                    <span class="text-sm text-[#737373]">综合: </span>
                    <span class="text-xl font-bold text-[#60A5FA]">{{ pipelineStore.score.overall_score?.toFixed(1) }}</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button @click="router.push(`/pipeline/${pipelineStore.currentTask?.id}`)" class="btn-primary">查看完整剧本</button>
                  <button @click="handleExport" class="btn-secondary">导出Markdown</button>
                </div>
              </div>
            </template>
            <template v-else>
              <div class="flex items-center justify-center h-full text-[#737373] text-sm">
                点击左侧已完成步骤查看内容预览
              </div>
            </template>
          </div>

          <!-- Log panel (bottom) -->
          <div class="h-[200px] flex-shrink-0 border-t border-[#2F2F2F] flex flex-col">
            <div class="px-4 py-2 flex items-center justify-between border-b border-[#2F2F2F]">
              <div class="flex items-center gap-2">
                <span class="text-xs text-[#737373] font-medium">实时日志</span>
                <div class="flex items-center rounded-md border border-[#2F2F2F] bg-[#191919] p-0.5 text-[10px]">
                  <button type="button" @click="logFilter = 'all'" :class="logFilter === 'all' ? 'px-2 py-1 rounded bg-[#2F2F2F] text-white' : 'px-2 py-1 text-[#737373] hover:text-white transition-colors'">全部</button>
                  <button type="button" @click="logFilter = 'summary'" :class="logFilter === 'summary' ? 'px-2 py-1 rounded bg-[#4C1D95]/40 text-[#DDD6FE]' : 'px-2 py-1 text-[#A78BFA] hover:text-[#DDD6FE] transition-colors'">摘要</button>
                </div>
              </div>
              <span class="text-[10px] text-[#525252]">{{ visibleLogs.length }}条</span>
            </div>
            <div ref="logPanelRef" class="flex-1 overflow-auto px-4 py-2 font-mono text-xs space-y-0.5">
              <div v-if="!visibleLogs.length" class="text-[#525252]">暂无日志</div>
              <div v-for="log in visibleLogs" :key="log.id" :class="isSummaryLog(log) ? 'rounded-md border border-[#8B5CF6]/20 bg-[#8B5CF6]/8 px-2 py-2 flex gap-2' : 'flex gap-2'">
                <span class="text-[#525252] flex-shrink-0">{{ log.time }}</span>
                <span :class="[
                  'flex-shrink-0',
                  isSummaryLog(log) ? 'text-[#C4B5FD]' : (log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-[#A3A3A3]')
                ]">[{{ isSummaryLog(log) ? 'SUM' : (log.type === 'error' ? 'ERR' : log.type === 'success' ? 'OK' : log.type === 'warning' ? 'WRN' : 'INF') }}]</span>
                <div class="min-w-0">
                  <div :class="isSummaryLog(log) ? 'text-[#E9D5FF] font-medium' : (log.type === 'error' ? 'text-red-300' : log.type === 'warning' ? 'text-yellow-200' : 'text-[#D4D4D4]')">{{ isSummaryLog(log) ? '当前任务摘要' : log.message }}</div>
                  <div v-if="log.detail" :class="isSummaryLog(log) ? 'text-[#D8B4FE] whitespace-pre-wrap leading-5 mt-1 break-words' : 'text-[#6E6E6E] whitespace-pre-wrap leading-5 mt-0.5 break-words'">{{ getVisibleDetail(log) }}</div>
                  <button
                    v-if="shouldCollapseDetail(log.detail)"
                    type="button"
                    @click="toggleLogExpanded(log.id)"
                    :class="isSummaryLog(log) ? 'mt-1 text-[10px] text-[#C4B5FD] hover:text-[#DDD6FE] transition-colors' : 'mt-1 text-[10px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors'"
                  >
                    {{ isLogExpanded(log.id) ? '收起详情' : '展开详情' }}
                  </button>
                </div>
              </div>
              <div v-if="!logs.length" class="text-[#525252]">等待日志...</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
