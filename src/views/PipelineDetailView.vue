<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRoute, useRouter, RouterLink } from 'vue-router';
import { usePipelineStore } from '@/stores/pipeline';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import type { AIConfig, AIService } from '@/types';

const route = useRoute();
const router = useRouter();
const pipelineStore = usePipelineStore();
const toast = useToast();

const taskId = route.params.id as string;
const versionLabel = ref('');
const versionChangeNotes = ref('');
const versionPreviewOpen = ref(false);
const compareMode = ref(false);
const compareBaseId = ref('');
const compareTargetId = ref('');
const branchSourceVersionId = ref('');
const branchLabel = ref('');
const branchChangeNotes = ref('');
const availableServices = ref<AIService[]>([]);
const configuredServices = ref<AIConfig[]>([]);
const loadingServices = ref(true);
const resumeService = ref('cloudflare-ai');
const resumeModel = ref('');
const nowTick = ref(Date.now());
let nowTimer: ReturnType<typeof setInterval> | null = null;

// 步骤内容预览
const expandedStep = ref<number | null>(null);
const stepContent = ref<Record<number, any>>({});

const resumeUsableServices = computed(() => {
  return availableServices.value.filter((service) => {
    if (service.id === 'cloudflare-ai') return true;
    const config = configuredServices.value.find((item) => item.service_name === service.id);
    return config?.validation_status === 'passed';
  });
});

const currentTaskServiceMeta = computed(() =>
  availableServices.value.find((service) => service.id === pipelineStore.currentTask?.ai_service),
);

const currentTaskServiceConfig = computed(() =>
  configuredServices.value.find((item) => item.service_name === pipelineStore.currentTask?.ai_service),
);

const resumeServiceMeta = computed(() =>
  availableServices.value.find((service) => service.id === resumeService.value),
);

const resumeModelSuggestions = computed(() => {
  const suggestions = [
    pipelineStore.currentTask?.ai_model,
    configuredServices.value.find((item) => item.service_name === resumeService.value)?.model,
    availableServices.value.find((item) => item.id === resumeService.value)?.defaultModel,
  ].filter((item): item is string => Boolean(item && item.trim()));

  return Array.from(new Set(suggestions));
});

function syncResumeSelectionFromTask() {
  const task = pipelineStore.currentTask;
  if (!task) return;
  resumeService.value = task.ai_service || 'cloudflare-ai';
  resumeModel.value = task.ai_model || currentTaskServiceConfig.value?.model || currentTaskServiceMeta.value?.defaultModel || '';
}

async function loadServices() {
  loadingServices.value = true;
  try {
    const [servicesResponse, configResponse] = await Promise.all([
      apiService.getAIServices(),
      apiService.getAIConfig(),
    ]);
    availableServices.value = servicesResponse.data?.services || [];
    configuredServices.value = configResponse.data?.configs || [];
    syncResumeSelectionFromTask();
  } catch (error: any) {
    toast.error(error.message || '加载模型渠道失败');
  } finally {
    loadingServices.value = false;
  }
}

onMounted(async () => {
  nowTimer = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);

  await Promise.all([
    pipelineStore.fetchStatus(taskId),
    loadServices(),
  ]);
  if (!pipelineStore.currentTask) {
    toast.error('任务不存在');
    router.push('/generate');
  }
  await Promise.all([
    pipelineStore.fetchSteps(taskId),
    pipelineStore.fetchVersions(taskId),
  ]);
});

onUnmounted(() => {
  if (nowTimer) {
    clearInterval(nowTimer);
    nowTimer = null;
  }
});

watch(() => pipelineStore.currentTask?.id, () => {
  syncResumeSelectionFromTask();
}, { immediate: true });

watch(() => resumeService.value, (serviceId) => {
  const config = configuredServices.value.find((item) => item.service_name === serviceId);
  const service = availableServices.value.find((item) => item.id === serviceId);
  if (serviceId === pipelineStore.currentTask?.ai_service) {
    resumeModel.value = pipelineStore.currentTask?.ai_model || config?.model || service?.defaultModel || '';
    return;
  }
  resumeModel.value = config?.model || service?.defaultModel || '';
});

async function toggleStepPreview(stepNumber: number) {
  if (expandedStep.value === stepNumber) {
    expandedStep.value = null;
    return;
  }
  expandedStep.value = stepNumber;
  if (!stepContent.value[stepNumber]) {
    try {
      const data = await pipelineStore.fetchStepContent(taskId, stepNumber);
      stepContent.value[stepNumber] = data.content;
    } catch {
      toast.error('获取步骤内容失败');
    }
  }
}

async function handleExport() {
  try {
    const filename = await pipelineStore.exportScript(taskId);
    toast.success(`已导出: ${filename}`);
  } catch (error: any) {
    toast.error(error.message || '导出失败');
  }
}

async function handlePause() {
  if (!pipelineStore.currentTask) return;
  try {
    await pipelineStore.pausePipeline(taskId);
    toast.success('任务已暂停');
  } catch (error: any) {
    toast.error(error.message || '暂停失败');
  }
}

async function handleResume() {
  if (!pipelineStore.currentTask) return;
  if (!resumeUsableServices.value.find((service) => service.id === resumeService.value)) {
    toast.error('所选恢复模型渠道尚未通过检测');
    return;
  }

  try {
    await pipelineStore.resumePipeline(taskId, {
      ai_service: resumeService.value,
      ai_model: resumeModel.value || undefined,
    });
    toast.success(`任务已恢复：${resumeService.value}${resumeModel.value ? ` / ${resumeModel.value}` : ''}`);
  } catch (error: any) {
    toast.error(error.message || '恢复失败');
  }
}

async function handleCreateVersion() {
  try {
    const version = await pipelineStore.createVersion(taskId, {
      label: versionLabel.value.trim() || undefined,
      changeNotes: versionChangeNotes.value.trim() || undefined,
    });
    versionLabel.value = '';
    versionChangeNotes.value = '';
    versionPreviewOpen.value = true;
    toast.success(`已创建版本 ${version.version}`);
  } catch (error: any) {
    toast.error(error.message || '创建版本失败');
  }
}

async function handleBranchVersion() {
  if (!branchSourceVersionId.value) {
    toast.error('请选择要派生的历史版本');
    return;
  }

  try {
    const version = await pipelineStore.branchVersion(taskId, Number(branchSourceVersionId.value), {
      label: branchLabel.value.trim() || undefined,
      changeNotes: branchChangeNotes.value.trim() || undefined,
    });

    branchLabel.value = '';
    branchChangeNotes.value = '';
    branchSourceVersionId.value = '';
    versionPreviewOpen.value = true;
    toast.success(`已创建派生版本 v${version.version}`);
  } catch (error: any) {
    toast.error(error.message || '派生版本失败');
  }
}

async function openVersion(versionId: number) {
  try {
    await pipelineStore.fetchVersionDetail(taskId, versionId);
    versionPreviewOpen.value = true;
  } catch (error: any) {
    toast.error(error.message || '加载版本失败');
  }
}

async function runVersionCompare() {
  if (!compareBaseId.value || !compareTargetId.value) {
    toast.error('请选择两个版本进行对比');
    return;
  }

  if (compareBaseId.value === compareTargetId.value) {
    toast.error('请为对比选择两个不同版本');
    return;
  }

  try {
    await Promise.all([
      pipelineStore.loadVersionForCompare(taskId, Number(compareBaseId.value), 'base'),
      pipelineStore.loadVersionForCompare(taskId, Number(compareTargetId.value), 'target'),
    ]);
    compareMode.value = true;
  } catch (error: any) {
    toast.error(error.message || '加载对比版本失败');
  }
}

function closeVersionCompare() {
  compareMode.value = false;
}

function formatDate(date: string) {
  return new Date(date).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getVersionTitle(version: { label: string | null; version: number } | null | undefined) {
  if (!version) return '';
  return version.label || `版本 ${version.version}`;
}

function getLineCount(content?: string) {
  if (!content) return 0;
  return content.split('\n').length;
}

function getCharacterCount(content?: string) {
  return content?.length || 0;
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildLineDiffMatrix(baseLines: string[], targetLines: string[]) {
  const matrix = Array.from({ length: baseLines.length + 1 }, () => Array(targetLines.length + 1).fill(0));

  for (let i = baseLines.length - 1; i >= 0; i -= 1) {
    for (let j = targetLines.length - 1; j >= 0; j -= 1) {
      if (baseLines[i] === targetLines[j]) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  return matrix;
}

function buildInlineDiffHtml(source: string, target: string, mode: 'base' | 'target') {
  if (source === target) return escapeHtml(mode === 'base' ? source : target);

  const sourceChars = source.split('');
  const targetChars = target.split('');
  const matrix = Array.from({ length: sourceChars.length + 1 }, () => Array(targetChars.length + 1).fill(0));

  for (let i = sourceChars.length - 1; i >= 0; i -= 1) {
    for (let j = targetChars.length - 1; j >= 0; j -= 1) {
      if (sourceChars[i] === targetChars[j]) {
        matrix[i][j] = matrix[i + 1][j + 1] + 1;
      } else {
        matrix[i][j] = Math.max(matrix[i + 1][j], matrix[i][j + 1]);
      }
    }
  }

  let i = 0;
  let j = 0;
  let html = '';
  const additionClass = 'bg-emerald-500/20 text-emerald-200 rounded px-0.5';
  const removalClass = 'bg-rose-500/20 text-rose-200 rounded px-0.5';

  while (i < sourceChars.length && j < targetChars.length) {
    if (sourceChars[i] === targetChars[j]) {
      html += escapeHtml(mode === 'base' ? sourceChars[i] : targetChars[j]);
      i += 1;
      j += 1;
    } else if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      if (mode === 'base') {
        html += `<span class="${removalClass}">${escapeHtml(sourceChars[i])}</span>`;
      }
      i += 1;
    } else {
      if (mode === 'target') {
        html += `<span class="${additionClass}">${escapeHtml(targetChars[j])}</span>`;
      }
      j += 1;
    }
  }

  while (i < sourceChars.length) {
    if (mode === 'base') {
      html += `<span class="${removalClass}">${escapeHtml(sourceChars[i])}</span>`;
    }
    i += 1;
  }

  while (j < targetChars.length) {
    if (mode === 'target') {
      html += `<span class="${additionClass}">${escapeHtml(targetChars[j])}</span>`;
    }
    j += 1;
  }

  return html;
}

type DiffLine = {
  type: 'same' | 'removed' | 'added' | 'modified';
  lineNumber: number | null;
  text: string;
  html: string;
};

const lineDiffView = computed(() => {
  const baseContent = pipelineStore.compareBaseVersion?.content;
  const targetContent = pipelineStore.compareTargetVersion?.content;

  if (!baseContent || !targetContent) {
    return { base: [] as DiffLine[], target: [] as DiffLine[] };
  }

  const baseLines = baseContent.split('\n');
  const targetLines = targetContent.split('\n');
  const matrix = buildLineDiffMatrix(baseLines, targetLines);

  const baseResult: DiffLine[] = [];
  const targetResult: DiffLine[] = [];

  let i = 0;
  let j = 0;
  let baseLineNumber = 1;
  let targetLineNumber = 1;

  while (i < baseLines.length && j < targetLines.length) {
    if (baseLines[i] === targetLines[j]) {
      const html = escapeHtml(baseLines[i]);
      baseResult.push({ type: 'same', lineNumber: baseLineNumber, text: baseLines[i], html });
      targetResult.push({ type: 'same', lineNumber: targetLineNumber, text: targetLines[j], html });
      i += 1;
      j += 1;
      baseLineNumber += 1;
      targetLineNumber += 1;
      continue;
    }

    const canPairAsModified = i + 1 <= baseLines.length && j + 1 <= targetLines.length
      && matrix[i + 1][j + 1] >= Math.max(matrix[i + 1][j], matrix[i][j + 1]);

    if (canPairAsModified) {
      baseResult.push({
        type: 'modified',
        lineNumber: baseLineNumber,
        text: baseLines[i],
        html: buildInlineDiffHtml(baseLines[i], targetLines[j], 'base'),
      });
      targetResult.push({
        type: 'modified',
        lineNumber: targetLineNumber,
        text: targetLines[j],
        html: buildInlineDiffHtml(baseLines[i], targetLines[j], 'target'),
      });
      i += 1;
      j += 1;
      baseLineNumber += 1;
      targetLineNumber += 1;
      continue;
    }

    if (matrix[i + 1][j] >= matrix[i][j + 1]) {
      baseResult.push({
        type: 'removed',
        lineNumber: baseLineNumber,
        text: baseLines[i],
        html: escapeHtml(baseLines[i]),
      });
      targetResult.push({
        type: 'removed',
        lineNumber: null,
        text: '',
        html: '',
      });
      i += 1;
      baseLineNumber += 1;
    } else {
      baseResult.push({
        type: 'added',
        lineNumber: null,
        text: '',
        html: '',
      });
      targetResult.push({
        type: 'added',
        lineNumber: targetLineNumber,
        text: targetLines[j],
        html: escapeHtml(targetLines[j]),
      });
      j += 1;
      targetLineNumber += 1;
    }
  }

  while (i < baseLines.length) {
    baseResult.push({
      type: 'removed',
      lineNumber: baseLineNumber,
      text: baseLines[i],
      html: escapeHtml(baseLines[i]),
    });
    targetResult.push({ type: 'removed', lineNumber: null, text: '', html: '' });
    i += 1;
    baseLineNumber += 1;
  }

  while (j < targetLines.length) {
    baseResult.push({ type: 'added', lineNumber: null, text: '', html: '' });
    targetResult.push({
      type: 'added',
      lineNumber: targetLineNumber,
      text: targetLines[j],
      html: escapeHtml(targetLines[j]),
    });
    j += 1;
    targetLineNumber += 1;
  }

  return { base: baseResult, target: targetResult };
});

const versionCompareSummary = computed(() => {
  const base = pipelineStore.compareBaseVersion;
  const target = pipelineStore.compareTargetVersion;

  if (!base || !target) return null;

  return {
    lineDelta: getLineCount(target.content) - getLineCount(base.content),
    charDelta: getCharacterCount(target.content) - getCharacterCount(base.content),
    sameContent: base.content === target.content,
  };
});

type OptimizationTask = {
  id: string;
  title: string;
  priority: 'high' | 'medium';
  category: string;
  diagnosis: string;
  action: string;
  target: string;
};

function getScoreValue(key: 'plot_score' | 'dialogue_score' | 'character_score' | 'pacing_score' | 'creativity_score') {
  return pipelineStore.score?.[key] ?? null;
}

const optimizationTasks = computed<OptimizationTask[]>(() => {
  const tasks: OptimizationTask[] = [];
  const suggestions = Array.isArray(evaluation.value?.suggestions) ? evaluation.value.suggestions : [];
  const storyCount = episodePlanCards.value.length;
  const relationCount = relationshipCards.value.length;

  const pushTask = (task: OptimizationTask) => {
    if (!tasks.some((item) => item.title === task.title)) {
      tasks.push(task);
    }
  };

  const plotScore = getScoreValue('plot_score');
  if (plotScore !== null && plotScore < 7) {
    pushTask({
      id: 'plot-upgrade',
      title: '重写主线冲突推进表',
      priority: plotScore < 5 ? 'high' : 'medium',
      category: '剧情',
      diagnosis: `当前剧情分 ${plotScore}，说明主冲突升级节奏还不够稳定。`,
      action: '回看“三幕结构”和“分集规划”，给每一幕补上更明确的目标、阻碍与反转节点。',
      target: storyCount ? `至少检查前 ${Math.min(3, storyCount)} 集的冲突升级和转折钩子。` : '优先补强主线冲突与反转链路。',
    });
  }

  const characterScore = getScoreValue('character_score');
  if (characterScore !== null && characterScore < 7) {
    pushTask({
      id: 'character-upgrade',
      title: '补足角色动机与关系张力',
      priority: characterScore < 5 ? 'high' : 'medium',
      category: '人物',
      diagnosis: `当前人物分 ${characterScore}，角色目标、欲望或关系冲突还不够有记忆点。`,
      action: '补写主角欲望、失去代价，以及关键人物之间的对立/依赖关系，让人物选择能真正推动剧情。',
      target: relationCount ? `重点重检现有 ${relationCount} 条关系是否都能制造戏剧张力。` : '优先补一组能制造冲突的人物关系。',
    });
  }

  const dialogueScore = getScoreValue('dialogue_score');
  if (dialogueScore !== null && dialogueScore < 7) {
    pushTask({
      id: 'dialogue-upgrade',
      title: '压缩解释性对白',
      priority: dialogueScore < 5 ? 'high' : 'medium',
      category: '对白',
      diagnosis: `当前对白分 ${dialogueScore}，对白可能偏直给、同质化或缺少人物辨识度。`,
      action: '把“告诉观众信息”的台词改成角色带目的的对话，增加反问、试探、隐瞒和情绪落差。',
      target: '优先修改开篇关键冲突场和高潮前一场对白。',
    });
  }

  const pacingScore = getScoreValue('pacing_score');
  if (pacingScore !== null && pacingScore < 7) {
    pushTask({
      id: 'pacing-upgrade',
      title: '重排节奏与每集钩子',
      priority: pacingScore < 5 ? 'high' : 'medium',
      category: '节奏',
      diagnosis: `当前节奏分 ${pacingScore}，说明分集推进可能存在拖沓或爆点不够密集的问题。`,
      action: '检查每集是否都在 1 个核心事件内快速推进，并确保结尾留有明确悬念或情绪断点。',
      target: storyCount ? `优先审查全部 ${storyCount} 集的 cliffhanger 是否足够强。` : '优先补足每集结尾钩子。',
    });
  }

  const creativityScore = getScoreValue('creativity_score');
  if (creativityScore !== null && creativityScore < 7) {
    pushTask({
      id: 'creativity-upgrade',
      title: '强化题材记忆点',
      priority: creativityScore < 5 ? 'high' : 'medium',
      category: '创意',
      diagnosis: `当前创意分 ${creativityScore}，整体设定或桥段可能还不够有差异化。`,
      action: '为世界观、反转机制或人物设定加入一个能被一句话记住的独特卖点。',
      target: '优先强化 logline、世界观和终局反转设计。',
    });
  }

  suggestions.slice(0, 5).forEach((suggestion: string, index: number) => {
    pushTask({
      id: `suggestion-${index}`,
      title: `落实建议 ${index + 1}`,
      priority: index < 2 ? 'high' : 'medium',
      category: '评审建议',
      diagnosis: suggestion,
      action: '将这条建议对应到具体集数、人物或场景，并在下一轮生成前作为硬性优化目标。',
      target: '建议写入新的版本说明，便于后续对比优化效果。',
    });
  });

  return tasks.slice(0, 6);
});

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

function isTaskStepPaused(step: { status: string }) {
  return pipelineStore.currentTask?.status === 'paused' && step.status === 'running';
}

function isActiveTaskStep(step: { status: string; step_number: number }) {
  return (step.status === 'running' || isTaskStepPaused(step))
    && step.step_number === pipelineStore.currentTask?.current_step;
}

function getActiveTaskModelLabel() {
  return pipelineStore.currentTask?.ai_model
    || currentTaskServiceConfig.value?.model
    || currentTaskServiceMeta.value?.defaultModel
    || '默认模型';
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function getStepElapsedLabel(step: { step_number: number; status: string; started_at?: string; completed_at?: string }) {
  if (!step.started_at) return '';

  const started = new Date(step.started_at).getTime();
  if (Number.isNaN(started)) return '';

  let ended: number | null = null;

  if (step.completed_at) {
    const completed = new Date(step.completed_at).getTime();
    ended = Number.isNaN(completed) ? null : completed;
  } else if (isTaskStepPaused(step) && pipelineStore.currentTask?.updated_at) {
    const pausedAt = new Date(pipelineStore.currentTask.updated_at).getTime();
    ended = Number.isNaN(pausedAt) ? null : pausedAt;
  } else if (isActiveTaskStep(step)) {
    ended = nowTick.value;
  }

  if (!ended || ended < started) return '';
  return formatDuration(ended - started);
}

function getStepLatestAIMetrics(stepNumber: number) {
  const logs = [...pipelineStore.realtimeLogs].reverse();
  const targetLog = logs.find((log) => log.step === stepNumber && /\[AI\] 响应成功/.test(log.message));

  if (!targetLog) return null;

  const durationMatch = targetLog.message.match(/耗时(\d+)ms/);
  const tokenMatch = targetLog.message.match(/tokens=([^·]+)/);

  return {
    duration: durationMatch ? formatDuration(Number(durationMatch[1])) : '',
    tokens: tokenMatch?.[1]?.trim() || '',
  };
}

function getStepLatestAIMetricsLabel(stepNumber: number) {
  const metrics = getStepLatestAIMetrics(stepNumber);
  if (!metrics) return '';

  const parts = [metrics.duration || '—'];
  if (metrics.tokens) {
    parts.push(metrics.tokens);
  }

  return parts.join(' · ');
}

// 解析故事大纲
const storyOutline = computed(() => {
  const step = pipelineStore.steps.find(s => s.step_number === 1);
  if (step?.content) {
    try { return JSON.parse(step.content); } catch {}
  }
  return null;
});

// 解析角色
const characters = computed(() => {
  const step = pipelineStore.steps.find(s => s.step_number === 2);
  if (step?.content) {
    try { return JSON.parse(step.content); } catch {}
  }
  return null;
});

// 解析集数计划
const episodePlan = computed(() => {
  const step = pipelineStore.steps.find(s => s.step_number === 4);
  if (step?.content) {
    try { return JSON.parse(step.content); } catch {}
  }
  return null;
});

// 解析评分
const evaluation = computed(() => {
  const step = pipelineStore.steps.find(s => s.step_number === 8);
  if (step?.content) {
    try { return JSON.parse(step.content); } catch {}
  }
  return null;
});

const threeActCards = computed(() => {
  const acts = storyOutline.value?.threeActs;
  if (!acts) return [];

  return [acts.act1, acts.act2, acts.act3]
    .filter(Boolean)
    .map((act: any, index: number) => ({
      id: `act-${index + 1}`,
      name: act.name || `第${index + 1}幕`,
      description: act.description || '',
      keyEvents: Array.isArray(act.keyEvents) ? act.keyEvents : [],
    }));
});

const relationshipCards = computed(() => {
  const relations = characters.value?.relationships;
  if (!Array.isArray(relations)) return [];

  return relations.map((rel: any, index: number) => ({
    id: `rel-${index}`,
    character1: rel.character1 || rel.char1 || '',
    character2: rel.character2 || rel.char2 || '',
    type: rel.type || rel.relation || '',
    description: rel.description || '',
    tension: rel.tension || '',
  }));
});

const majorCliffhangerCards = computed(() => {
  const cliffhangers = episodePlan.value?.majorCliffhangers;
  if (!Array.isArray(cliffhangers)) return [];

  return cliffhangers.map((item: any, index: number) => ({
    id: `cliff-${index}`,
    episodeNumber: item?.episodeNumber,
    description: item?.description || String(item || ''),
  }));
});

const episodePlanCards = computed(() => {
  const episodes = episodePlan.value?.episodes;
  if (!Array.isArray(episodes)) return [];

  return episodes.map((ep: any, index: number) => ({
    id: `ep-${ep.episodeNumber || ep.episode_number || index + 1}`,
    episodeNumber: ep.episodeNumber || ep.episode_number || index + 1,
    title: ep.title || '',
    act: ep.act || '',
    summary: ep.summary || '',
    keyEvents: Array.isArray(ep.keyEvents)
      ? ep.keyEvents
      : Array.isArray(ep.key_events)
        ? ep.key_events
        : [],
    pacing: ep.pacing || '',
    emotionalTone: ep.emotionalTone || ep.emotion || '',
    cliffhanger: ep.cliffhanger || '',
  }));
});

const generatedEpisodeMap = computed(() => {
  const map = new Map<number, { status: string; title?: string; summary?: string }>();
  pipelineStore.episodes.forEach((episode) => {
    map.set(episode.episode_number, {
      status: episode.status,
      title: episode.title,
      summary: episode.summary,
    });
  });
  return map;
});

function isEpisodeAvailable(episodeNumber: number) {
  return generatedEpisodeMap.value.get(episodeNumber)?.status === 'completed';
}

function openEpisodeDetail(episodeNumber: number) {
  if (!isEpisodeAvailable(episodeNumber)) {
    toast.error(`第${episodeNumber}集尚未生成，暂时无法查看详情`);
    return;
  }

  router.push(`/pipeline/${taskId}/episode/${episodeNumber}`);
}

function formatActLabel(act: string) {
  const labels: Record<string, string> = {
    first_act: '第一幕',
    second_act: '第二幕',
    third_act: '第三幕',
  };

  return labels[act] || act;
}
</script>

<template>
  <div class="min-h-screen tech-bg grid-bg">
    <!-- 导航栏 -->
    <nav class="border-b border-gray-700/50 backdrop-blur-lg bg-gray-900/50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex justify-between h-16 items-center">
          <RouterLink to="/" class="flex items-center space-x-2">
            <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span class="text-xl font-bold gradient-text">AI剧本生成器</span>
          </RouterLink>
          
          <div class="flex items-center space-x-4">
            <RouterLink to="/generate" class="btn-primary text-sm">开始创作</RouterLink>
            <RouterLink to="/history" class="text-gray-400 hover:text-white transition-colors">历史记录</RouterLink>
          </div>
        </div>
      </div>
    </nav>

    <main class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <RouterLink to="/generate" class="inline-flex items-center text-gray-400 hover:text-white mb-6 transition-colors">
        <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        返回
      </RouterLink>

      <div v-if="pipelineStore.loading" class="flex justify-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
      </div>

      <div v-else-if="pipelineStore.currentTask" class="space-y-6">
        <!-- 标题和操作 -->
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-3xl font-bold text-white mb-2">{{ pipelineStore.currentTask.title }}</h1>
            <div class="flex items-center gap-3 text-sm text-gray-400">
              <span>{{ pipelineStore.currentTask.genre }}</span>
              <span>|</span>
              <span>{{ pipelineStore.currentTask.script_type }}</span>
              <span>|</span>
              <span>{{ pipelineStore.currentTask.total_episodes }}集</span>
              <span>|</span>
              <span>{{ pipelineStore.currentTask.ai_service || 'cloudflare-ai' }}</span>
              <span>|</span>
              <span>{{ pipelineStore.currentTask.ai_model || '默认模型' }}</span>
              <span :class="[
                'px-2 py-0.5 rounded text-xs',
                pipelineStore.currentTask.status === 'completed' ? 'bg-green-500/10 text-green-400' :
                pipelineStore.currentTask.status === 'running' ? 'bg-sky-500/10 text-sky-400' :
                'bg-yellow-500/10 text-yellow-400'
              ]">
                {{ pipelineStore.currentTask.status === 'completed' ? '已完成' : pipelineStore.currentTask.status === 'running' ? '生成中' : '已暂停' }}
              </span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2 text-xs">
              <span class="px-2 py-1 rounded-full bg-sky-500/10 text-sky-300 border border-sky-500/20">
                渠道：{{ currentTaskServiceMeta?.name || pipelineStore.currentTask.ai_service || 'cloudflare-ai' }}
              </span>
              <span class="px-2 py-1 rounded-full bg-gray-800 text-gray-200 border border-gray-700">
                模型：{{ pipelineStore.currentTask.ai_model || currentTaskServiceConfig?.model || currentTaskServiceMeta?.defaultModel || '默认模型' }}
              </span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button v-if="pipelineStore.isRunning" @click="handlePause" class="btn-secondary text-sm">暂停</button>
            <button v-if="pipelineStore.isCompleted" @click="handleExport" class="btn-secondary text-sm">
              <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              导出Markdown
            </button>
          </div>
        </div>

        <div v-if="pipelineStore.isPaused" class="card border-yellow-500/20 bg-yellow-500/5">
          <div class="flex flex-col lg:flex-row lg:items-end gap-3">
            <div class="flex-1 grid md:grid-cols-[220px,1fr] gap-3">
              <div>
                <label class="block text-xs text-yellow-200 mb-1">恢复渠道</label>
                <select v-model="resumeService" :disabled="loadingServices" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-yellow-400 disabled:opacity-60">
                  <option v-for="service in resumeUsableServices" :key="service.id" :value="service.id">{{ service.name }}</option>
                </select>
              </div>
              <div>
                <label class="block text-xs text-yellow-200 mb-1">恢复模型</label>
                <datalist id="detail-resume-models">
                  <option v-for="modelOption in resumeModelSuggestions" :key="modelOption" :value="modelOption"></option>
                </datalist>
                <input v-model="resumeModel" list="detail-resume-models" type="text" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-yellow-400" :placeholder="resumeServiceMeta?.defaultModel || '输入模型名称'" />
                <div v-if="resumeModelSuggestions.length" class="mt-2 flex flex-wrap gap-1.5">
                  <button v-for="modelOption in resumeModelSuggestions" :key="modelOption" type="button" @click="resumeModel = modelOption" class="px-2 py-0.5 rounded-full border border-gray-700 text-[11px] text-gray-300 hover:border-yellow-400 hover:text-yellow-200 transition-colors">
                    {{ modelOption }}
                  </button>
                </div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button @click="handleResume" class="btn-primary text-sm">恢复执行</button>
            </div>
          </div>
          <div class="mt-3 text-xs text-yellow-100/80">默认使用提交任务时选择的模型；你也可以在恢复前切换为当前渠道下的新模型。</div>
        </div>

        <div class="flex items-center gap-2">
          <button @click="handleExport" class="btn-secondary text-sm">
            <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            导出Markdown
          </button>
        </div>

        <!-- 流水线步骤状态 -->
        <div class="card">
          <h2 class="text-xl font-semibold text-white mb-4">流水线步骤</h2>
          <div class="space-y-2">
            <div
              v-for="step in (pipelineStore.steps.length ? pipelineStore.steps : [
                { step_number: 1, step_name: 'story_outline', status: 'pending', error_message: '' },
                { step_number: 2, step_name: 'characters', status: 'pending', error_message: '' },
                { step_number: 3, step_name: 'plot_structure', status: 'pending', error_message: '' },
                { step_number: 4, step_name: 'episode_plan', status: 'pending', error_message: '' },
                { step_number: 5, step_name: 'scenes', status: 'pending', error_message: '' },
                { step_number: 6, step_name: 'dialogue', status: 'pending', error_message: '' },
                { step_number: 7, step_name: 'compose', status: 'pending', error_message: '' },
                { step_number: 8, step_name: 'evaluate', status: 'pending', error_message: '' },
              ])"
              :key="step.step_number"
              class="rounded-lg border overflow-hidden"
              :class="[
                step.status === 'completed' ? 'border-green-500/30 bg-green-500/5' :
                isTaskStepPaused(step) ? 'border-yellow-500/30 bg-yellow-500/5' :
                step.status === 'running' ? 'border-sky-500/50 bg-sky-500/5 animate-pulse' :
                step.status === 'failed' ? 'border-red-500/30 bg-red-500/5' :
                'border-gray-700 bg-gray-800/30'
              ]"
            >
              <div
                class="flex items-center justify-between p-3 cursor-pointer hover:bg-white/5 transition-colors"
                @click="step.status === 'completed' ? toggleStepPreview(step.step_number) : null"
              >
                <div class="flex items-center gap-3">
                  <div :class="[
                   'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
                    step.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                    isTaskStepPaused(step) ? 'bg-yellow-500/20 text-yellow-300' :
                    step.status === 'running' ? 'bg-sky-500/20 text-sky-400' :
                    step.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                    'bg-gray-700 text-gray-500'
                  ]">
                    <svg v-if="step.status === 'completed'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>
                    <svg v-else-if="isTaskStepPaused(step)" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M6 4h3v12H6zM11 4h3v12h-3z" /></svg>
                    <svg v-else-if="step.status === 'running'" class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                    <svg v-else-if="step.status === 'failed'" class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                    <span v-else>{{ step.step_number }}</span>
                  </div>
                  <div>
                    <div class="text-white font-medium">{{ STEP_LABELS[step.step_name] || step.step_name }}</div>
                    <div v-if="isActiveTaskStep(step)" class="mt-1 inline-flex max-w-full rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-gray-200 truncate">
                      模型：{{ getActiveTaskModelLabel() }}
                    </div>
                    <div v-if="getStepElapsedLabel(step)" class="text-[10px] text-gray-400 mt-0.5">耗时：{{ getStepElapsedLabel(step) }}</div>
                    <div v-if="getStepLatestAIMetrics(step.step_number)" class="text-[10px] text-sky-300 mt-0.5">
                      最近AI：{{ getStepLatestAIMetricsLabel(step.step_number) }}
                    </div>
                    <div v-if="isTaskStepPaused(step)" class="text-yellow-300 text-xs mt-0.5">当前节点已暂停</div>
                    <div v-if="step.error_message" class="text-red-400 text-xs mt-0.5">{{ step.error_message }}</div>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <span v-if="step.status === 'completed'" class="text-xs text-green-400">点击查看内容</span>
                  <svg v-if="step.status === 'completed'" :class="['w-4 h-4 text-gray-400 transition-transform', expandedStep === step.step_number ? 'rotate-180' : '']" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
              <!-- 展开的内容预览 -->
              <div v-if="expandedStep === step.step_number && stepContent[step.step_number]" class="border-t border-gray-700 p-4 bg-gray-900/50 max-h-96 overflow-y-auto">
                <pre class="text-gray-300 text-sm whitespace-pre-wrap font-sans">{{ JSON.stringify(stepContent[step.step_number], null, 2) }}</pre>
              </div>
            </div>
          </div>
        </div>

        <!-- 异常日志 -->
        <div v-if="pipelineStore.currentTask.error_message" class="card border-red-500/30 bg-red-500/5">
          <h2 class="text-xl font-semibold text-red-400 mb-4">⚠ 异常日志</h2>
          <pre class="text-red-300 text-sm whitespace-pre-wrap font-mono">{{ pipelineStore.currentTask.error_message }}</pre>
        </div>

        <div class="card">
          <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6 mb-6">
            <div>
              <h2 class="text-xl font-semibold text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                版本管理
              </h2>
              <p class="text-sm text-gray-400 mt-1">为当前完整剧本创建快照，记录阶段成果与变更说明。</p>
            </div>
            <div class="text-sm text-gray-400">
              共 <span class="text-white font-semibold">{{ pipelineStore.versions.length }}</span> 个版本
            </div>
          </div>

          <div v-if="pipelineStore.versions.length >= 2" class="mb-6 p-4 rounded-lg border border-violet-500/20 bg-violet-500/5">
            <div class="flex flex-col lg:flex-row lg:items-end gap-3">
              <div class="flex-1 grid md:grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs text-violet-300 mb-1">基准版本</label>
                  <select v-model="compareBaseId" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                    <option value="">选择版本</option>
                    <option v-for="version in pipelineStore.versions" :key="`base-${version.id}`" :value="String(version.id)">
                      v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-violet-300 mb-1">对比版本</label>
                  <select v-model="compareTargetId" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                    <option value="">选择版本</option>
                    <option v-for="version in pipelineStore.versions" :key="`target-${version.id}`" :value="String(version.id)">
                      v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="flex gap-2">
                <button @click="runVersionCompare" :disabled="pipelineStore.versioning" class="px-4 py-2 rounded-lg bg-violet-500 text-white text-sm hover:bg-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ pipelineStore.versioning ? '加载中...' : '开始对比' }}
                </button>
                <button v-if="compareMode" @click="closeVersionCompare" class="btn-secondary text-sm">关闭对比</button>
              </div>
            </div>
          </div>

          <div v-if="compareMode && pipelineStore.compareBaseVersion && pipelineStore.compareTargetVersion" class="mb-6 space-y-4">
            <div class="grid md:grid-cols-3 gap-3">
              <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <div class="text-xs text-gray-500 mb-1">内容变化</div>
                <div class="text-sm font-medium" :class="versionCompareSummary?.sameContent ? 'text-emerald-400' : 'text-violet-300'">
                  {{ versionCompareSummary?.sameContent ? '内容一致' : '存在差异' }}
                </div>
              </div>
              <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <div class="text-xs text-gray-500 mb-1">行数变化</div>
                <div class="text-sm font-medium" :class="(versionCompareSummary?.lineDelta || 0) >= 0 ? 'text-cyan-300' : 'text-amber-300'">
                  {{ (versionCompareSummary?.lineDelta || 0) >= 0 ? '+' : '' }}{{ versionCompareSummary?.lineDelta || 0 }} 行
                </div>
              </div>
              <div class="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50">
                <div class="text-xs text-gray-500 mb-1">字符变化</div>
                <div class="text-sm font-medium" :class="(versionCompareSummary?.charDelta || 0) >= 0 ? 'text-cyan-300' : 'text-amber-300'">
                  {{ (versionCompareSummary?.charDelta || 0) >= 0 ? '+' : '' }}{{ versionCompareSummary?.charDelta || 0 }} 字
                </div>
              </div>
            </div>

            <div class="grid xl:grid-cols-2 gap-4">
              <div class="bg-gray-950/60 border border-gray-700/50 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-gray-700/50">
                  <div class="text-sm font-medium text-white">{{ getVersionTitle(pipelineStore.compareBaseVersion) }}</div>
                  <div class="text-xs text-gray-500 mt-1">v{{ pipelineStore.compareBaseVersion.version }} · {{ formatDate(pipelineStore.compareBaseVersion.created_at) }}</div>
                  <div v-if="pipelineStore.compareBaseVersion.change_notes" class="text-xs text-gray-400 mt-2 whitespace-pre-wrap">{{ pipelineStore.compareBaseVersion.change_notes }}</div>
                </div>
                <div class="max-h-[520px] overflow-auto text-sm font-mono">
                  <div
                    v-for="(line, index) in lineDiffView.base"
                    :key="`base-line-${index}`"
                    class="grid grid-cols-[56px,1fr] border-b border-gray-900/60"
                    :class="[
                      line.type === 'removed' ? 'bg-rose-500/8' : '',
                      line.type === 'modified' ? 'bg-amber-500/8' : '',
                      line.type === 'added' ? 'bg-gray-900/50' : '',
                    ]"
                  >
                    <div class="px-3 py-1.5 text-right select-none border-r border-gray-800/80"
                      :class="[
                        line.type === 'removed' ? 'text-rose-300' : '',
                        line.type === 'modified' ? 'text-amber-300' : 'text-gray-600',
                      ]">
                      {{ line.lineNumber ?? '' }}
                    </div>
                    <div class="px-3 py-1.5 whitespace-pre-wrap break-words leading-relaxed"
                      :class="[
                        line.type === 'removed' ? 'text-rose-100' : '',
                        line.type === 'modified' ? 'text-amber-50' : 'text-gray-300',
                        line.type === 'added' ? 'text-gray-700' : '',
                      ]"
                      v-html="line.html || '&nbsp;'"
                    ></div>
                  </div>
                </div>
              </div>

              <div class="bg-gray-950/60 border border-violet-500/30 rounded-lg overflow-hidden">
                <div class="px-4 py-3 border-b border-violet-500/20 bg-violet-500/5">
                  <div class="text-sm font-medium text-white">{{ getVersionTitle(pipelineStore.compareTargetVersion) }}</div>
                  <div class="text-xs text-gray-500 mt-1">v{{ pipelineStore.compareTargetVersion.version }} · {{ formatDate(pipelineStore.compareTargetVersion.created_at) }}</div>
                  <div v-if="pipelineStore.compareTargetVersion.change_notes" class="text-xs text-gray-400 mt-2 whitespace-pre-wrap">{{ pipelineStore.compareTargetVersion.change_notes }}</div>
                </div>
                <div class="max-h-[520px] overflow-auto text-sm font-mono">
                  <div
                    v-for="(line, index) in lineDiffView.target"
                    :key="`target-line-${index}`"
                    class="grid grid-cols-[56px,1fr] border-b border-gray-900/60"
                    :class="[
                      line.type === 'added' ? 'bg-emerald-500/8' : '',
                      line.type === 'modified' ? 'bg-amber-500/8' : '',
                      line.type === 'removed' ? 'bg-gray-900/50' : '',
                    ]"
                  >
                    <div class="px-3 py-1.5 text-right select-none border-r border-gray-800/80"
                      :class="[
                        line.type === 'added' ? 'text-emerald-300' : '',
                        line.type === 'modified' ? 'text-amber-300' : 'text-gray-600',
                      ]">
                      {{ line.lineNumber ?? '' }}
                    </div>
                    <div class="px-3 py-1.5 whitespace-pre-wrap break-words leading-relaxed"
                      :class="[
                        line.type === 'added' ? 'text-emerald-100' : '',
                        line.type === 'modified' ? 'text-amber-50' : 'text-gray-300',
                        line.type === 'removed' ? 'text-gray-700' : '',
                      ]"
                      v-html="line.html || '&nbsp;'"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid lg:grid-cols-[320px,1fr] gap-6">
            <div class="space-y-4">
              <div class="bg-gray-800/50 border border-gray-700/50 rounded-lg p-4 space-y-3">
                <div>
                  <label class="block text-xs text-gray-400 mb-1">版本标签</label>
                  <input v-model="versionLabel" type="text" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-cyan-500" placeholder="如：平台投前版 / 节奏优化版" />
                </div>
                <div>
                  <label class="block text-xs text-gray-400 mb-1">变更说明</label>
                  <textarea v-model="versionChangeNotes" rows="4" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-cyan-500" placeholder="记录本轮优化目标、修改侧重点或交付用途"></textarea>
                </div>
                <button @click="handleCreateVersion" :disabled="pipelineStore.versioning || !pipelineStore.episodes.length" class="btn-primary w-full text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ pipelineStore.versioning ? '创建中...' : '创建版本快照' }}
                </button>
              </div>

              <div class="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4 space-y-3">
                <div>
                  <div class="text-sm font-medium text-white mb-1">从历史版本派生</div>
                  <p class="text-xs text-gray-400">不会覆盖现有版本，而是复制历史稿件生成一个新的工作分支。</p>
                </div>
                <div>
                  <label class="block text-xs text-violet-300 mb-1">源版本</label>
                  <select v-model="branchSourceVersionId" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                    <option value="">选择历史版本</option>
                    <option v-for="version in pipelineStore.versions" :key="`branch-${version.id}`" :value="String(version.id)">
                      v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}
                    </option>
                  </select>
                </div>
                <div>
                  <label class="block text-xs text-violet-300 mb-1">新版本标签</label>
                  <input v-model="branchLabel" type="text" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" placeholder="如：从初稿分叉的改编版" />
                </div>
                <div>
                  <label class="block text-xs text-violet-300 mb-1">派生说明</label>
                  <textarea v-model="branchChangeNotes" rows="3" class="w-full px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" placeholder="说明为什么从这个历史版本继续推进"></textarea>
                </div>
                <button @click="handleBranchVersion" :disabled="pipelineStore.versioning || !pipelineStore.versions.length" class="w-full px-4 py-2 rounded-lg bg-violet-500 text-white text-sm hover:bg-violet-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {{ pipelineStore.versioning ? '派生中...' : '创建派生版本' }}
                </button>
              </div>

              <div class="bg-gray-800/40 border border-gray-700/50 rounded-lg p-3 max-h-[420px] overflow-auto space-y-2">
                <button
                  v-for="version in pipelineStore.versions"
                  :key="version.id"
                  @click="openVersion(version.id)"
                  class="w-full text-left p-3 rounded-lg border transition-colors"
                  :class="pipelineStore.selectedVersion?.id === version.id ? 'border-cyan-500/60 bg-cyan-500/10' : 'border-gray-700 bg-gray-900/60 hover:border-gray-600'"
                >
                  <div class="flex items-center justify-between gap-2 mb-1">
                    <div class="text-sm font-semibold text-white truncate">{{ version.label || `版本 ${version.version}` }}</div>
                    <span class="text-[11px] px-2 py-0.5 rounded bg-gray-800 text-cyan-300">v{{ version.version }}</span>
                  </div>
                  <div class="text-[11px] text-gray-500 mb-1">{{ formatDate(version.created_at) }}</div>
                  <div v-if="version.change_notes" class="text-xs text-gray-400 line-clamp-2">{{ version.change_notes }}</div>
                </button>
                <div v-if="!pipelineStore.versions.length" class="text-sm text-gray-500 text-center py-6">暂无版本快照</div>
              </div>
            </div>

            <div class="bg-gray-950/60 border border-gray-700/50 rounded-lg min-h-[420px] flex flex-col overflow-hidden">
              <div class="px-4 py-3 border-b border-gray-700/50 flex items-center justify-between">
                <div>
                  <div class="text-sm font-medium text-white">{{ pipelineStore.selectedVersion?.label || '版本预览' }}</div>
                  <div v-if="pipelineStore.selectedVersion" class="text-xs text-gray-500 mt-1">v{{ pipelineStore.selectedVersion.version }} · {{ formatDate(pipelineStore.selectedVersion.created_at) }}</div>
                </div>
                <button v-if="pipelineStore.selectedVersion" @click="versionPreviewOpen = !versionPreviewOpen" class="text-xs text-cyan-300 hover:text-cyan-200 transition-colors">
                  {{ versionPreviewOpen ? '收起内容' : '展开内容' }}
                </button>
              </div>
              <div v-if="pipelineStore.selectedVersion" class="p-4 overflow-auto">
                <div v-if="pipelineStore.selectedVersion.change_notes" class="mb-4 p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
                  <div class="text-xs text-cyan-300 mb-1">变更说明</div>
                  <p class="text-sm text-gray-300 whitespace-pre-wrap">{{ pipelineStore.selectedVersion.change_notes }}</p>
                </div>
                <pre v-if="versionPreviewOpen" class="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed">{{ pipelineStore.selectedVersion.content }}</pre>
                <div v-else class="text-sm text-gray-400">点击“展开内容”查看该版本的完整 Markdown 剧本。</div>
              </div>
              <div v-else class="flex-1 flex items-center justify-center text-sm text-gray-500 p-6">选择左侧版本查看内容</div>
            </div>
          </div>
        </div>

        <!-- 1. 项目简报 Project Brief -->
        <div v-if="storyOutline" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            项目简报
          </h2>
          <div class="grid md:grid-cols-2 gap-6">
            <div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div class="text-sm text-sky-400 mb-2 font-medium">一句话概括 (Logline)</div>
              <div class="text-white text-lg font-medium leading-snug">{{ storyOutline.logline }}</div>
            </div>
            <div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div class="text-sm text-sky-400 mb-2 font-medium">核心冲突 (Core Conflict)</div>
              <div class="text-gray-300">{{ storyOutline.coreConflict }}</div>
            </div>
          </div>
          <div class="mt-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div class="text-sm text-sky-400 mb-2 font-medium">故事梗概 (Synopsis)</div>
            <div class="text-gray-300 leading-relaxed">{{ storyOutline.synopsis }}</div>
          </div>
          <div class="mt-4 grid md:grid-cols-3 gap-4">
            <div class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div class="text-sm text-gray-400 mb-1">主题 (Theme)</div>
              <div class="text-white">{{ storyOutline.theme }}</div>
            </div>
            <div v-if="storyOutline.tone" class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div class="text-sm text-gray-400 mb-1">基调 (Tone)</div>
              <div class="text-white">{{ storyOutline.tone }}</div>
            </div>
            <div v-if="storyOutline.targetAudience" class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
              <div class="text-sm text-gray-400 mb-1">目标受众 (Target Audience)</div>
              <div class="text-white">{{ storyOutline.targetAudience }}</div>
            </div>
          </div>
          <div v-if="storyOutline.worldSetting" class="mt-4 bg-gray-800/50 p-4 rounded-lg border border-gray-700/50">
            <div class="text-sm text-sky-400 mb-2 font-medium">世界观设定 (World Setting)</div>
            <div class="text-gray-300 leading-relaxed">{{ storyOutline.worldSetting }}</div>
          </div>
        </div>

        <!-- 2. 三幕结构 Three-Act Structure -->
        <div v-if="threeActCards.length" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
            三幕结构
          </h2>
          <div class="grid md:grid-cols-3 gap-4">
            <div v-for="act in threeActCards" :key="act.id" class="bg-gray-800/50 p-4 rounded-lg border border-gray-700/50 relative overflow-hidden">
              <div class="absolute top-0 right-0 w-16 h-16 bg-purple-500/5 rounded-bl-full -z-10"></div>
              <div class="text-purple-400 font-bold mb-2">{{ act.name }}</div>
              <div class="text-white font-medium mb-2">{{ act.description }}</div>
              <ul v-if="act.keyEvents && act.keyEvents.length" class="space-y-1 mt-3">
                <li v-for="(event, i) in act.keyEvents" :key="i" class="text-sm text-gray-400 flex items-start gap-2">
                  <span class="text-purple-500/50 mt-0.5">•</span>
                  <span>{{ event }}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <!-- 3. 角色设定 Characters -->
        <div v-if="characters" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            角色与关系
          </h2>
          
          <!-- 主角 -->
          <div v-if="characters.protagonist" class="mb-6 p-5 bg-emerald-500/5 border border-emerald-500/20 rounded-lg relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-bl-full -z-10"></div>
            <div class="flex items-center gap-3 mb-3">
              <span class="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-bold tracking-wider">主角 PROTAGONIST</span>
              <span class="text-2xl font-bold text-white">{{ characters.protagonist.name }}</span>
              <span class="text-gray-400 text-sm px-2 py-0.5 bg-gray-800 rounded-full">{{ characters.protagonist.age }} | {{ characters.protagonist.gender }}</span>
            </div>
            <div class="grid md:grid-cols-2 gap-4 mt-4">
              <div>
                <div class="text-xs text-emerald-500/70 mb-1 uppercase tracking-wider">性格特征</div>
                <p class="text-gray-300 text-sm">{{ characters.protagonist.personality }}</p>
              </div>
              <div>
                <div class="text-xs text-emerald-500/70 mb-1 uppercase tracking-wider">核心目标</div>
                <p class="text-gray-300 text-sm">{{ characters.protagonist.goal }}</p>
              </div>
            </div>
          </div>

          <!-- 配角 -->
          <div v-if="characters.characters?.length" class="grid md:grid-cols-2 gap-4 mb-6">
            <div v-for="char in characters.characters" :key="char.name" class="p-4 bg-gray-800/50 border border-gray-700/50 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <span class="text-white font-bold text-lg">{{ char.name }}</span>
                <span class="text-xs px-2 py-1 bg-gray-700 text-gray-300 rounded">{{ char.role }}</span>
              </div>
              <p class="text-gray-400 text-sm">{{ char.personality }}</p>
            </div>
          </div>

          <!-- 人物关系 -->
          <div v-if="relationshipCards.length" class="mt-6">
            <div class="text-sm text-emerald-400 mb-3 font-medium">核心关系网</div>
            <div class="grid md:grid-cols-2 gap-3">
              <div v-for="rel in relationshipCards" :key="rel.id" class="p-3 bg-gray-800 border border-gray-700 rounded-lg">
                <div class="flex items-center gap-2 text-sm mb-1">
                  <span class="text-white font-medium">{{ rel.character1 }}</span>
                  <svg class="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                  <span class="text-white font-medium">{{ rel.character2 }}</span>
                  <span v-if="rel.type" class="text-gray-400 text-xs">({{ rel.type }})</span>
                </div>
                <p v-if="rel.description" class="text-xs text-gray-400 leading-relaxed">{{ rel.description }}</p>
                <p v-if="rel.tension" class="text-xs text-amber-400/80 mt-1">冲突点：{{ rel.tension }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 4. 集数计划 Episode Plan -->
        <div v-if="episodePlanCards.length" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
            分集规划
          </h2>
          
          <div v-if="majorCliffhangerCards.length" class="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
            <div class="text-sm text-amber-400 mb-2 font-medium">核心悬念 (Major Cliffhangers)</div>
            <ul class="space-y-1">
              <li v-for="cliff in majorCliffhangerCards" :key="cliff.id" class="text-sm text-gray-300 flex items-start gap-2">
                <span class="text-amber-500/50 mt-0.5">⚡</span>
                <span>
                  <template v-if="cliff.episodeNumber">第{{ cliff.episodeNumber }}集：</template>{{ cliff.description }}
                </span>
              </li>
            </ul>
          </div>

          <div class="grid md:grid-cols-2 gap-4">
            <button
              v-for="ep in episodePlanCards"
              :key="ep.id"
              type="button"
              @click="openEpisodeDetail(ep.episodeNumber)"
              class="text-left bg-gray-800/50 border rounded-lg p-4 flex flex-col transition-all"
              :class="isEpisodeAvailable(ep.episodeNumber)
                ? 'border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/5 hover:-translate-y-0.5 cursor-pointer'
                : 'border-gray-700/50 opacity-85 hover:border-gray-600/70'"
            >
              <div class="flex justify-between items-start mb-2">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-1 bg-gray-700 text-white text-xs font-bold rounded">EP {{ ep.episodeNumber }}</span>
                  <span class="text-white font-medium">{{ ep.title || `第${ep.episodeNumber}集` }}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span
                    class="text-[11px] px-2 py-0.5 rounded"
                    :class="isEpisodeAvailable(ep.episodeNumber)
                      ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      : 'bg-gray-900 text-gray-500 border border-gray-700'"
                  >
                    {{ isEpisodeAvailable(ep.episodeNumber) ? '查看集稿' : '待生成' }}
                  </span>
                  <span v-if="ep.act" class="text-xs text-gray-500 border border-gray-600 px-1.5 py-0.5 rounded">{{ formatActLabel(ep.act) }}</span>
                </div>
              </div>

              <p class="text-sm text-gray-300 mb-3 flex-grow">{{ ep.summary }}</p>
              
              <div v-if="ep.keyEvents?.length" class="mb-3">
                <div class="text-xs text-gray-500 mb-1">关键事件</div>
                <ul class="space-y-1">
                  <li v-for="(event, idx) in ep.keyEvents" :key="idx" class="text-xs text-gray-400 flex items-start gap-1.5">
                    <span class="text-gray-600 mt-0.5">-</span>
                    <span>{{ event }}</span>
                  </li>
                </ul>
              </div>

              <div class="mt-auto pt-3 border-t border-gray-700/50 flex flex-wrap gap-2 text-xs">
                <span v-if="ep.pacing" class="px-2 py-1 bg-gray-900 rounded text-gray-400">节奏: {{ ep.pacing }}</span>
                <span v-if="ep.emotionalTone" class="px-2 py-1 bg-gray-900 rounded text-gray-400">情绪: {{ ep.emotionalTone }}</span>
                <span v-if="ep.cliffhanger" class="px-2 py-1 bg-amber-500/10 text-amber-400/90 rounded border border-amber-500/20 w-full mt-1">
                  钩子: {{ ep.cliffhanger }}
                </span>
              </div>
            </button>
          </div>
        </div>

        <!-- 5. 评估与建议 Evaluation -->
        <div v-if="pipelineStore.score || evaluation" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
            剧本评估
          </h2>
          
          <div v-if="pipelineStore.score" class="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div v-for="(label, key) in { plot_score: '剧情', dialogue_score: '对白', character_score: '人物', pacing_score: '节奏', creativity_score: '创意' }" :key="key" class="text-center p-3 bg-gray-800/50 border border-gray-700/50 rounded-lg">
              <div class="text-3xl font-bold" :class="(pipelineStore.score[key as keyof typeof pipelineStore.score] as number) >= 7 ? 'text-green-400' : (pipelineStore.score[key as keyof typeof pipelineStore.score] as number) >= 5 ? 'text-yellow-400' : 'text-red-400'">
                {{ pipelineStore.score[key as keyof typeof pipelineStore.score] }}
              </div>
              <div class="text-sm text-gray-500 mt-1">{{ label }}</div>
            </div>
          </div>
          
          <div v-if="pipelineStore.score" class="text-center mb-6">
            <span class="text-gray-400">综合评分: </span>
            <span class="text-4xl font-bold gradient-text">{{ pipelineStore.score.overall_score?.toFixed(1) }}</span>
            <span class="text-gray-500"> / 10</span>
          </div>

          <div v-if="evaluation?.strengths?.length || evaluation?.suggestions?.length" class="grid md:grid-cols-2 gap-6">
            <div v-if="evaluation.strengths?.length" class="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
              <div class="text-sm text-green-400 mb-3 font-medium flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" /></svg>
                亮点与优势
              </div>
              <ul class="space-y-2">
                <li v-for="(item, idx) in evaluation.strengths" :key="idx" class="text-sm text-gray-300 flex items-start gap-2">
                  <span class="text-green-500/50 mt-0.5">✓</span>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
            
            <div v-if="evaluation.suggestions?.length" class="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
              <div class="text-sm text-rose-400 mb-3 font-medium flex items-center gap-2">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                改进建议
              </div>
              <ul class="space-y-2">
                <li v-for="(item, idx) in evaluation.suggestions" :key="idx" class="text-sm text-gray-300 flex items-start gap-2">
                  <span class="text-rose-500/50 mt-0.5">→</span>
                  <span>{{ item }}</span>
                </li>
              </ul>
            </div>
          </div>

          <div v-if="optimizationTasks.length" class="mt-6">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-4 h-4 text-cyan-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              <h3 class="text-sm font-semibold text-white">下一轮可执行优化任务</h3>
            </div>
            <div class="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              <div v-for="task in optimizationTasks" :key="task.id" class="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-4">
                <div class="flex items-center justify-between gap-2 mb-3">
                  <span class="text-xs px-2 py-1 rounded bg-gray-900 text-cyan-300">{{ task.category }}</span>
                  <span :class="['text-[11px] px-2 py-1 rounded', task.priority === 'high' ? 'bg-rose-500/15 text-rose-300' : 'bg-amber-500/15 text-amber-300']">
                    {{ task.priority === 'high' ? '高优先级' : '中优先级' }}
                  </span>
                </div>
                <div class="text-sm font-semibold text-white mb-2">{{ task.title }}</div>
                <div class="space-y-3 text-sm">
                  <div>
                    <div class="text-[11px] uppercase tracking-wider text-gray-500 mb-1">诊断</div>
                    <p class="text-gray-300 leading-relaxed">{{ task.diagnosis }}</p>
                  </div>
                  <div>
                    <div class="text-[11px] uppercase tracking-wider text-gray-500 mb-1">执行动作</div>
                    <p class="text-gray-300 leading-relaxed">{{ task.action }}</p>
                  </div>
                  <div>
                    <div class="text-[11px] uppercase tracking-wider text-gray-500 mb-1">落实目标</div>
                    <p class="text-cyan-100 leading-relaxed">{{ task.target }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 6. 剧本内容 (集数导航) -->
        <div v-if="pipelineStore.episodes.length > 0" class="card">
          <h2 class="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg class="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
            剧本内容 ({{ pipelineStore.episodes.length }}集)
          </h2>
          <div class="grid grid-cols-5 md:grid-cols-10 gap-2">
            <RouterLink
              v-for="ep in pipelineStore.episodes"
              :key="ep.episode_number"
              :to="`/pipeline/${taskId}/episode/${ep.episode_number}`"
              :class="[
                'p-3 rounded-lg text-center transition-all hover:scale-105',
                ep.status === 'completed'
                  ? 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 cursor-pointer'
                  : 'bg-gray-700 text-gray-500 border border-gray-600'
              ]"
              :title="ep.title || `第${ep.episode_number}集`"
            >
              <div class="font-medium">{{ ep.episode_number }}</div>
            </RouterLink>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.card {
  @apply p-6 bg-gray-900/50 backdrop-blur-sm border border-gray-700/50 rounded-xl;
}
.btn-primary {
  @apply px-6 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors font-medium;
}
.btn-secondary {
  @apply px-4 py-2 bg-gray-700 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors;
}
</style>
