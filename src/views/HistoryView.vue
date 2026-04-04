<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useScriptStore } from '@/stores/script';
import { usePipelineStore } from '@/stores/pipeline';
import { useToast } from '@/composables/useToast';

const scriptStore = useScriptStore();
const pipelineStore = usePipelineStore();
const router = useRouter();
const toast = useToast();

// Track which task is currently being exported
const exportingTaskId = ref<string | null>(null);

const activeTab = ref<'pipeline' | 'scripts'>('pipeline');
const taskSearch = ref('');
const statusFilter = ref<'all' | 'running' | 'completed' | 'paused' | 'failed' | 'pending'>('all');

const STEP_LABELS: Record<string, string> = {
  story_outline: '故事大纲', characters: '角色设定', plot_structure: '剧情结构',
  episode_plan: '集数计划', scenes: '场景生成', dialogue: '对白生成',
  compose: '剧本合成', evaluate: '剧本评分',
};

onMounted(async () => {
  try {
    await pipelineStore.fetchTaskList(1, 50);
    await scriptStore.fetchHistory();
  } catch (error: any) {
    toast.error(error.message || '获取失败');
  }
});

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(s: string) {
  return { running: '生成中', completed: '已完成', paused: '已暂停', failed: '已失败', pending: '等待中' }[s] || s;
}

function getStatusColor(s: string) {
  return {
    running: 'bg-green-500', completed: 'bg-blue-500', paused: 'bg-yellow-500', failed: 'bg-red-500', pending: 'bg-[#525252]',
  }[s] || 'bg-[#525252]';
}

function getStepLabel(stepName: string) {
  return STEP_LABELS[stepName] || stepName;
}

const taskStats = computed(() => {
  const stats = {
    total: pipelineStore.tasks.length,
    running: 0,
    completed: 0,
    paused: 0,
    failed: 0,
  };

  pipelineStore.tasks.forEach((task) => {
    if (task.status === 'running') stats.running += 1;
    if (task.status === 'completed') stats.completed += 1;
    if (task.status === 'paused') stats.paused += 1;
    if (task.status === 'failed') stats.failed += 1;
  });

  return stats;
});

const recentCompletedTask = computed(() =>
  [...pipelineStore.tasks]
    .filter((task) => task.status === 'completed')
    .sort((a, b) => +new Date(b.updated_at || b.created_at) - +new Date(a.updated_at || a.created_at))[0] || null,
);

const recentActiveTask = computed(() =>
  [...pipelineStore.tasks]
    .filter((task) => task.status === 'running' || task.status === 'paused')
    .sort((a, b) => +new Date(b.updated_at || b.created_at) - +new Date(a.updated_at || a.created_at))[0] || null,
);

function getPrimaryTaskAction(task: any) {
  if (task.status === 'running') return { label: '进入工作台', path: `/pipeline/${task.id}/editor` };
  if (task.status === 'paused') return { label: '恢复项目', path: `/pipeline/${task.id}/editor` };
  if (task.status === 'completed') return { label: '进入工作台', path: `/pipeline/${task.id}/editor` };
  if (task.status === 'failed') return { label: '查看失败原因', path: `/pipeline/${task.id}/editor` };
  return { label: '打开项目', path: `/pipeline/${task.id}/editor` };
}

const filteredTasks = computed(() => {
  const keyword = taskSearch.value.trim().toLowerCase();

  return pipelineStore.tasks.filter((task) => {
    const matchesStatus = statusFilter.value === 'all' || task.status === statusFilter.value;
    const matchesKeyword = !keyword
      || task.title.toLowerCase().includes(keyword)
      || task.genre.toLowerCase().includes(keyword)
      || task.script_type.toLowerCase().includes(keyword);

    return matchesStatus && matchesKeyword;
  });
});

async function deleteScript(id: number) {
  if (!confirm('确定删除？')) return;
  try { await scriptStore.deleteScript(id); toast.success('已删除'); } catch (e: any) { toast.error(e.message); }
}

async function handleExport(taskId: string, event: Event) {
  event.stopPropagation(); // Prevent navigation when clicking the export button
  exportingTaskId.value = taskId;
  try {
    const filename = await pipelineStore.exportScript(taskId);
    toast.success(`已导出: ${filename}`);
  } catch (error: any) {
    toast.error(error.message || '导出失败');
  } finally {
    exportingTaskId.value = null;
  }
}
</script>

<template>
  <div class="p-6">
    <div class="max-w-6xl mx-auto">
      <div class="flex justify-between items-center mb-6">
        <div>
          <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-2">Project Library / Writer Room Archive</div>
          <h1 class="text-2xl font-semibold text-white">项目库</h1>
          <p class="text-sm text-[#737373]">集中查看进行中的项目、已完成版本与可恢复的生成任务。</p>
        </div>
        <RouterLink to="/generate" class="btn-primary text-sm">创建新项目</RouterLink>
      </div>

      <div class="grid xl:grid-cols-[1.1fr,0.9fr] gap-4 mb-6">
        <div class="card !p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">当前创作焦点</div>
              <div class="text-base font-semibold text-white">{{ recentActiveTask?.title || '暂无活跃项目' }}</div>
            </div>
            <span class="text-[11px] px-2 py-1 rounded-full" :class="recentActiveTask ? 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20' : 'bg-[#2F2F2F] text-[#737373]'">
              {{ recentActiveTask ? getStatusLabel(recentActiveTask.status) : '空闲中' }}
            </span>
          </div>
          <div v-if="recentActiveTask" class="space-y-3">
            <div class="text-sm text-[#A3A3A3]">{{ recentActiveTask.genre }} · {{ recentActiveTask.total_episodes }} 集 · 当前在 {{ getStepLabel(['', 'story_outline', 'characters', 'plot_structure', 'episode_plan', 'scenes', 'dialogue', 'compose', 'evaluate'][recentActiveTask.current_step] || '') }}</div>
            <div class="h-2 bg-[#2F2F2F] rounded-full overflow-hidden">
              <div class="h-full bg-[#2563EB]" :style="{ width: `${recentActiveTask.total_episodes > 0 ? (recentActiveTask.completed_episodes / recentActiveTask.total_episodes * 100) : 0}%` }"></div>
            </div>
            <div class="flex items-center justify-between text-xs text-[#737373]">
              <span>已完成 {{ recentActiveTask.completed_episodes }}/{{ recentActiveTask.total_episodes }} 集</span>
              <span>{{ formatDate(recentActiveTask.updated_at || recentActiveTask.created_at) }}</span>
            </div>
            <RouterLink :to="getPrimaryTaskAction(recentActiveTask).path" class="btn-secondary text-sm inline-flex">{{ getPrimaryTaskAction(recentActiveTask).label }}</RouterLink>
          </div>
          <div v-else class="text-sm text-[#737373]">暂无运行中或暂停中的项目，可直接新建一个项目开始创作。</div>
        </div>

        <div class="card !p-5">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-[#666] mb-1">最近可交付版本</div>
              <div class="text-base font-semibold text-white">{{ recentCompletedTask?.title || '暂无已完成项目' }}</div>
            </div>
            <span class="px-2 py-1 rounded-full text-[11px]" :class="recentCompletedTask ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-[#2F2F2F] text-[#737373]'">
              {{ recentCompletedTask ? '可进入工作台' : '等待首个成稿' }}
            </span>
          </div>
          <div v-if="recentCompletedTask" class="space-y-3">
            <div class="text-sm text-[#A3A3A3]">{{ recentCompletedTask.genre }} · {{ recentCompletedTask.total_episodes }} 集 · 已生成完成</div>
            <div class="grid grid-cols-3 gap-3 text-center">
              <div class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-3">
                <div class="text-[11px] text-[#737373] mb-1">状态</div>
                <div class="text-sm text-emerald-300 font-medium">已完成</div>
              </div>
              <div class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-3">
                <div class="text-[11px] text-[#737373] mb-1">集数</div>
                <div class="text-sm text-white font-medium">{{ recentCompletedTask.total_episodes }}</div>
              </div>
              <div class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-3">
                <div class="text-[11px] text-[#737373] mb-1">更新</div>
                <div class="text-sm text-white font-medium">{{ new Date(recentCompletedTask.updated_at || recentCompletedTask.created_at).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) }}</div>
              </div>
            </div>
            <div class="flex gap-2">
              <RouterLink :to="`/pipeline/${recentCompletedTask.id}`" class="btn-secondary text-sm">进入工作台</RouterLink>
              <RouterLink :to="`/pipeline/${recentCompletedTask.id}/editor`" class="btn-primary text-sm">编辑成稿</RouterLink>
            </div>
          </div>
          <div v-else class="text-sm text-[#737373]">完成项目后，你可以在这里直接进入工作台或成稿编辑器。</div>
        </div>
      </div>

      <div class="grid md:grid-cols-4 gap-3 mb-6">
        <div class="card !p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">总任务</div>
          <div class="text-2xl font-semibold text-white">{{ taskStats.total }}</div>
        </div>
        <div class="card !p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">进行中</div>
          <div class="text-2xl font-semibold text-green-400">{{ taskStats.running }}</div>
        </div>
        <div class="card !p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">已完成</div>
          <div class="text-2xl font-semibold text-blue-400">{{ taskStats.completed }}</div>
        </div>
        <div class="card !p-4">
          <div class="text-[11px] text-[#737373] uppercase tracking-wider mb-1">暂停 / 失败</div>
          <div class="text-2xl font-semibold text-amber-400">{{ taskStats.paused + taskStats.failed }}</div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-4 mb-6 border-b border-[#2F2F2F]">
        <button @click="activeTab = 'pipeline'" :class="['pb-2 text-sm transition-colors', activeTab === 'pipeline' ? 'text-white border-b-2 border-[#2563EB]' : 'text-[#737373] hover:text-[#A3A3A3]']">
          生成任务 ({{ pipelineStore.tasks.length }})
        </button>
        <button @click="activeTab = 'scripts'" :class="['pb-2 text-sm transition-colors', activeTab === 'scripts' ? 'text-white border-b-2 border-[#2563EB]' : 'text-[#737373] hover:text-[#A3A3A3]']">
          旧版剧本 ({{ scriptStore.scripts.length }})
        </button>
      </div>

      <!-- Pipeline tasks -->
      <div v-if="activeTab === 'pipeline'">
        <div class="card !p-4 mb-4">
          <div class="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <div class="flex-1">
              <label class="block text-[11px] text-[#737373] uppercase tracking-wider mb-1">搜索项目</label>
              <input
                v-model="taskSearch"
                type="text"
                class="input-field"
                placeholder="按标题、题材或类型搜索"
              />
            </div>
            <div class="md:w-[220px]">
              <label class="block text-[11px] text-[#737373] uppercase tracking-wider mb-1">状态筛选</label>
              <select v-model="statusFilter" class="input-field">
                <option value="all">全部状态</option>
                <option value="running">生成中</option>
                <option value="completed">已完成</option>
                <option value="paused">已暂停</option>
                <option value="failed">已失败</option>
                <option value="pending">等待中</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="pipelineStore.loading" class="flex justify-center py-12">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2563EB]"></div>
        </div>
        <div v-else-if="!pipelineStore.tasks.length" class="text-center py-16">
          <p class="text-[#737373] mb-4">还没有生成任务</p>
          <RouterLink to="/generate" class="btn-primary">开始创作</RouterLink>
        </div>
        <div v-else-if="!filteredTasks.length" class="text-center py-16 card">
          <p class="text-white mb-2">没有符合条件的项目</p>
          <p class="text-sm text-[#737373]">试试更换关键词或状态筛选</p>
        </div>
        <div v-else class="space-y-2">
          <div v-for="task in filteredTasks" :key="task.id"
            @click="router.push(getPrimaryTaskAction(task).path)"
            class="card hover:border-[#404040] transition-colors cursor-pointer">
            <div class="flex items-start justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-white truncate">{{ task.title }}</span>
                  <span :class="['inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded', getStatusColor(task.status), 'text-white']">
                    {{ getStatusLabel(task.status) }}
                  </span>
                  <span class="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] rounded bg-[#1F2937] text-[#9CA3AF]">
                    {{ getStepLabel(['', 'story_outline', 'characters', 'plot_structure', 'episode_plan', 'scenes', 'dialogue', 'compose', 'evaluate'][task.current_step] || '') || `步骤 ${task.current_step}` }}
                  </span>
                </div>
                <div class="flex items-center gap-3 text-[11px] text-[#737373]">
                  <span>{{ task.genre }}</span>
                  <span>{{ task.total_episodes }}集</span>
                  <span>步骤 {{ task.current_step }}/8</span>
                  <span>已完成 {{ task.completed_episodes }}集</span>
                  <span>动作：{{ getPrimaryTaskAction(task).label }}</span>
                </div>
                <!-- Progress bar -->
                <div class="mt-2 h-1 bg-[#2F2F2F] rounded-full overflow-hidden">
                  <div class="h-full bg-[#2563EB] rounded-full transition-all" :style="{ width: `${task.total_episodes > 0 ? (task.completed_episodes / task.total_episodes * 100) : 0}%` }"></div>
                </div>
                <div class="mt-1 text-[10px] text-[#525252]">{{ formatDate(task.created_at) }}</div>
              </div>
              <div class="ml-3 flex flex-col items-end gap-2 flex-shrink-0">
                <RouterLink :to="getPrimaryTaskAction(task).path" class="px-3 py-1.5 text-xs rounded bg-[#2F2F2F] text-[#E5E5E5] hover:bg-[#404040] transition-colors">
                  {{ getPrimaryTaskAction(task).label }}
                </RouterLink>
                <button 
                  @click="handleExport(task.id, $event)"
                  :disabled="exportingTaskId === task.id"
                  class="px-3 py-1.5 text-xs rounded bg-[#181818] text-[#A3A3A3] hover:bg-[#2A2A2A] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  <svg v-if="exportingTaskId === task.id" class="w-3 h-3 mr-1 inline animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {{ exportingTaskId === task.id ? '导出中...' : '导出Markdown' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Old scripts -->
      <div v-if="activeTab === 'scripts'">
        <div v-if="!scriptStore.hasScripts" class="text-center py-16">
          <p class="text-[#737373]">没有旧版剧本记录</p>
        </div>
        <div v-else class="space-y-2">
          <RouterLink v-for="script in scriptStore.scripts" :key="script.id" :to="`/script/${script.id}`"
            class="block card hover:border-[#404040] transition-colors cursor-pointer">
            <div class="flex items-center justify-between">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                  <span class="text-sm font-medium text-white truncate">{{ script.title }}</span>
                </div>
                <div class="flex items-center gap-3 text-[11px] text-[#737373]">
                  <span>{{ script.genre }}</span>
                  <span>{{ formatDate(script.created_at) }}</span>
                </div>
              </div>
              <button @click.prevent="deleteScript(script.id)" class="p-1.5 text-[#525252] hover:text-red-400 transition-colors">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          </RouterLink>
        </div>
      </div>
    </div>
  </div>
</template>
