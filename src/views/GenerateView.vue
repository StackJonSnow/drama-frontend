<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { usePipelineStore } from '@/stores/pipeline';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import type { AIConfig, AIService, ScriptType } from '@/types';
import { GENRE_OPTIONS, SCRIPT_TYPE_OPTIONS } from '@/types';

const router = useRouter();
const route = useRoute();
const pipelineStore = usePipelineStore();
const toast = useToast();
const initialTaskId = typeof route.query.taskId === 'string' ? route.query.taskId : '';

const formData = ref({
  title: '', genre: '', script_type: 'tv' as ScriptType,
  style: '', target_platform: '', target_duration: 60,
  character_count: 5, key_points: [] as string[],
  characters_input: [] as string[], scene_input: '',
  ai_service: 'cloudflare-ai', total_episodes: 50,
});

const newCharacter = ref('');
const newKeyPoint = ref('');
const hasExistingTask = ref(false);
const loadingTask = ref(Boolean(initialTaskId));
const availableServices = ref<AIService[]>([]);
const configuredServices = ref<AIConfig[]>([]);
const loadingServices = ref(true);

// Log panel
const logPanelRef = ref<HTMLElement | null>(null);
const logs = ref<{ id: number; time: string; type: 'info' | 'success' | 'warning' | 'error'; message: string; detail?: string }[]>([]);
const expandedLogIds = ref<number[]>([]);
let logIdSeed = 1;

function addLog(type: 'info' | 'success' | 'warning' | 'error', message: string, detail?: string) {
  const time = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  logs.value.push({ id: logIdSeed++, time, type, message, detail });
  nextTick(() => {
    if (logPanelRef.value) logPanelRef.value.scrollTop = logPanelRef.value.scrollHeight;
  });
}

function shouldCollapseDetail(detail?: string) {
  return Boolean(detail && detail.length > 700);
}

function isLogExpanded(id: number) {
  return expandedLogIds.value.includes(id);
}

function toggleLogExpanded(id: number) {
  if (isLogExpanded(id)) {
    expandedLogIds.value = expandedLogIds.value.filter((item) => item !== id);
    return;
  }

  expandedLogIds.value = [...expandedLogIds.value, id];
}

function getVisibleDetail(log: { id: number; detail?: string }) {
  if (!log.detail) return '';
  if (isLogExpanded(log.id) || !shouldCollapseDetail(log.detail)) return log.detail;
  return `${log.detail.slice(0, 700)}\n\n...（已折叠 ${log.detail.length - 700} 个字符）`;
}

// Step preview
const previewStep = ref<number | null>(null);
const stepPreviewContent = ref<any>(null);

const STEP_LABELS: Record<string, string> = {
  story_outline: '故事大纲', characters: '角色设定', plot_structure: '剧情结构',
  episode_plan: '集数计划', scenes: '场景生成', dialogue: '对白生成',
  compose: '剧本合成', evaluate: '剧本评分',
};

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
    const [servicesResponse, configResponse] = await Promise.all([
      apiService.getAIServices(),
      apiService.getAIConfig(),
    ]);

    availableServices.value = servicesResponse.data?.services || [];
    configuredServices.value = configResponse.data?.configs || [];

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
  const taskId = initialTaskId;
  if (taskId) {
    try {
      await pipelineStore.fetchStatus(taskId);
      await pipelineStore.fetchSteps(taskId);
      hasExistingTask.value = true;
      logs.value = [];
      previewStep.value = null;
    } catch (error: any) {
      toast.error(error.message || '加载任务失败');
    } finally {
      loadingTask.value = false;
    }
  }
});

onUnmounted(() => { pipelineStore.closeStream(); });

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
  logs.value = [];
  addLog('info', '正在启动流水线...');
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
      ai_service: formData.value.ai_service, total_episodes: formData.value.total_episodes,
    });
    addLog('success', `任务已启动: ${taskId}`);
    hasExistingTask.value = true;
  } catch (error: any) {
    addLog('error', `启动失败: ${error.message}`);
    toast.error(error.message);
  }
}

async function handlePause() {
  if (!pipelineStore.currentTask) return;
  await pipelineStore.pausePipeline(pipelineStore.currentTask.id);
  addLog('info', '任务已暂停');
}

async function handleResume() {
  if (!pipelineStore.currentTask) return;
  await pipelineStore.resumePipeline(pipelineStore.currentTask.id);
  addLog('info', '任务已恢复');
}

async function handleCancel() {
  if (!pipelineStore.currentTask || !confirm('确定取消？')) return;
  await pipelineStore.cancelPipeline(pipelineStore.currentTask.id);
  addLog('info', '任务已取消');
  hasExistingTask.value = false;
}

async function handleExport() {
  if (!pipelineStore.currentTask) return;
  try {
    const filename = await pipelineStore.exportScript(pipelineStore.currentTask.id);
    addLog('success', `已导出: ${filename}`);
  } catch (error: any) { addLog('error', `导出失败: ${error.message}`); }
}

async function viewStepPreview(stepNumber: number) {
  if (!pipelineStore.currentTask) return;
  if (previewStep.value === stepNumber) { previewStep.value = null; return; }
  previewStep.value = stepNumber;
  try {
    const data = await pipelineStore.fetchStepContent(pipelineStore.currentTask.id, stepNumber);
    stepPreviewContent.value = data.content;
  } catch { toast.error('加载步骤内容失败'); }
}

function startNew() {
  pipelineStore.clearCurrentTask();
  hasExistingTask.value = false;
  logs.value = [];
  expandedLogIds.value = [];
  previewStep.value = null;
  formData.value = {
    title: '', genre: '', script_type: 'tv', style: '', target_platform: '',
    target_duration: 60, character_count: 5, key_points: [], characters_input: [],
    scene_input: '', ai_service: 'cloudflare-ai', total_episodes: 50,
  };
  if (!usableServices.value.find((service) => service.id === formData.value.ai_service)) {
    formData.value.ai_service = usableServices.value[0]?.id || 'cloudflare-ai';
  }
}

const stepPulseClass = 'before:absolute before:-inset-1 before:rounded-xl before:border before:border-[#60A5FA]/40 before:animate-ping';

watch(() => pipelineStore.realtimeLogs, (entries) => {
  const latest = entries[entries.length - 1];
  if (!latest) return;

  const detail = latest.detail ? `\n${latest.detail}` : undefined;
  addLog(latest.level, latest.message, detail);
}, { deep: true });
watch(() => pipelineStore.errorLogs, (logs) => {
  const latest = logs[logs.length - 1];
  if (latest) addLog('error', `[Step ${latest.step}] ${latest.message}`);
}, { deep: true });
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
          <h1 class="text-xl font-semibold text-white mb-1">创作新剧本</h1>
          <p class="text-sm text-[#737373] mb-6">填写创意信息，AI将通过8步流水线为您生成专业剧本</p>

          <form @submit.prevent="startPipeline" class="space-y-4">
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
            <div>
              <label class="block text-xs text-[#A3A3A3] mb-1.5">背景描述</label>
              <textarea v-model="formData.scene_input" rows="2" class="input-field" placeholder="故事发生的地点、时代背景等"></textarea>
            </div>

            <!-- Characters -->
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
            <!-- Progress bar -->
            <div class="mt-2 h-1 bg-[#2F2F2F] rounded-full overflow-hidden">
              <div class="h-full bg-[#2563EB] rounded-full transition-all duration-500" :style="{ width: `${pipelineStore.progressPercent}%` }"></div>
            </div>
          </div>

          <!-- Steps list -->
          <div class="flex-1 overflow-auto py-1">
            <div v-for="step in (pipelineStore.steps.length ? pipelineStore.steps : [1,2,3,4,5,6,7,8].map(n => ({step_number:n, step_name:['','story_outline','characters','plot_structure','episode_plan','scenes','dialogue','compose','evaluate'][n], status:'pending', error_message:''})))"
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
                  step.status === 'running' ? 'bg-[#2563EB]/20 text-[#60A5FA]' :
                  step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                  'bg-[#2F2F2F] text-[#737373]'
                ]">
                  <svg v-if="step.status === 'completed'" class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                  <span v-else-if="step.status === 'running'" class="inline-flex gap-[2px] items-center">
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce"></span>
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:120ms]"></span>
                    <span class="w-1 h-1 rounded-full bg-current animate-bounce [animation-delay:240ms]"></span>
                  </span>
                  <span v-else>{{ step.step_number }}</span>
                </div>
                <span v-if="step.status === 'running'" class="absolute inset-0 rounded-full border border-[#60A5FA]/40 animate-ping"></span>
                </div>
                <div class="min-w-0 flex-1">
                  <div class="text-xs text-[#D4D4D4]">{{ STEP_LABELS[step.step_name] || step.step_name }}</div>
                  <div v-if="step.status === 'running'" class="text-[10px] text-[#60A5FA] mt-0.5">执行中...</div>
                  <div v-if="step.error_message" class="text-[10px] text-red-400 truncate">{{ step.error_message }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Controls -->
          <div class="px-3 py-2 border-t border-[#2F2F2F] flex gap-2">
            <button v-if="pipelineStore.isRunning" @click="handlePause" class="btn-secondary flex-1 text-xs py-1.5">暂停</button>
            <button v-if="pipelineStore.isPaused" @click="handleResume" class="btn-primary flex-1 text-xs py-1.5">恢复</button>
            <button v-if="pipelineStore.isRunning || pipelineStore.isPaused" @click="handleCancel" class="btn-secondary flex-1 text-xs py-1.5 text-red-400">取消</button>
            <button v-if="pipelineStore.isCompleted" @click="handleExport" class="btn-primary flex-1 text-xs py-1.5">导出Markdown</button>
            <button v-if="pipelineStore.isCompleted || pipelineStore.currentTask?.status === 'failed'" @click="startNew" class="btn-ghost flex-1 text-xs py-1.5">新建</button>
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
              <span class="text-xs text-[#737373] font-medium">实时日志</span>
              <span class="text-[10px] text-[#525252]">{{ logs.length }}条</span>
            </div>
            <div ref="logPanelRef" class="flex-1 overflow-auto px-4 py-2 font-mono text-xs space-y-0.5">
              <div v-for="log in logs" :key="log.id" class="flex gap-2">
                <span class="text-[#525252] flex-shrink-0">{{ log.time }}</span>
                <span :class="[
                  'flex-shrink-0',
                  log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-[#A3A3A3]'
                ]">[{{ log.type === 'error' ? 'ERR' : log.type === 'success' ? 'OK' : log.type === 'warning' ? 'WRN' : 'INF' }}]</span>
                <div class="min-w-0">
                  <div :class="log.type === 'error' ? 'text-red-300' : log.type === 'warning' ? 'text-yellow-200' : 'text-[#D4D4D4]'">{{ log.message }}</div>
                  <div v-if="log.detail" class="text-[#6E6E6E] whitespace-pre-wrap leading-5 mt-0.5 break-words">{{ getVisibleDetail(log) }}</div>
                  <button
                    v-if="shouldCollapseDetail(log.detail)"
                    type="button"
                    @click="toggleLogExpanded(log.id)"
                    class="mt-1 text-[10px] text-[#60A5FA] hover:text-[#93C5FD] transition-colors"
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
