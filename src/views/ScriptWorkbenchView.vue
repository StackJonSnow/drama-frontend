<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';
import apiService from '@/services/api';
import { useToast } from '@/composables/useToast';

const route = useRoute();
const toast = useToast();
const taskId = route.params.id as string;

const loading = ref(true);
const saving = ref(false);
const publishing = ref(false);
const title = ref('');
const content = ref('');
const sourceVersionId = ref<number | null>(null);
const autosaveState = ref<'idle' | 'saving' | 'saved'>('idle');
const versions = ref<any[]>([]);
const compareBaseId = ref<number | null>(null);
const compareTargetId = ref<number | null>(null);
const compareResult = ref<any | null>(null);
type ScreenplayBlockType = 'scene-heading' | 'action' | 'character' | 'dialogue' | 'transition' | 'note';
type ScreenplayBlock = { id: string; type: ScreenplayBlockType; text: string };

const screenplayBlocks = ref<ScreenplayBlock[]>([]);
const selectedBlockId = ref<string | null>(null);
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;
const sceneHeadingPresets = [
  '## 场景 1',
  '**INT. 控制室 - 夜晚**',
  '**EXT. 月球背面基地 - 黄昏**',
  '**INT. 记忆走廊 - 深夜**',
];

const diffRows = computed(() => compareResult.value?.diff || []);
const sceneNavigator = computed(() => {
  return screenplayBlocks.value
    .map((block, index) => ({ block, index }))
    .filter(({ block }) => block.type === 'scene-heading')
    .map(({ block, index }) => ({
      id: block.id,
      label: block.text || `场景 ${index + 1}`,
      index,
      type: 'scene' as const,
    }));
});

const blockTypeOptions: Array<{ value: ScreenplayBlockType; label: string; hint: string }> = [
  { value: 'scene-heading', label: '场景标题', hint: 'INT./EXT. 或场景标题' },
  { value: 'action', label: '动作描述', hint: '场景动作与环境描写' },
  { value: 'character', label: '角色名', hint: '角色出场名' },
  { value: 'dialogue', label: '对白', hint: '角色对白正文' },
  { value: 'transition', label: '转场', hint: 'CUT TO / ---' },
  { value: 'note', label: '注释', hint: '编辑备注或制作提示' },
];

function createBlock(type: ScreenplayBlockType = 'action', text = ''): ScreenplayBlock {
  return {
    id: `block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    text,
  };
}

function normalizeSceneHeading(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (/^(INT\.|EXT\.|##\s*场景)/i.test(trimmed)) return trimmed;
  return `## ${trimmed}`;
}

function parseContentToBlocks(raw: string): ScreenplayBlock[] {
  const segments = raw
    .split(/\n{2,}/)
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (!segments.length) {
    return [
      createBlock('scene-heading', '## 场景 1'),
      createBlock('action', '在这里输入场景动作描述...'),
    ];
  }

  return segments.map((segment) => {
    if (/^(##\s*场景|\*\*(INT\.|EXT\.))/i.test(segment)) {
      return createBlock('scene-heading', segment.replace(/^\*\*|\*\*$/g, ''));
    }
    if (/^\*\*.+\*\*$/.test(segment) && !/^\*\*(INT\.|EXT\.)/i.test(segment)) {
      return createBlock('character', segment.replace(/^\*\*|\*\*$/g, ''));
    }
    if (/^>/.test(segment)) {
      return createBlock('dialogue', segment.replace(/^>\s?/, ''));
    }
    if (/^---$/.test(segment)) {
      return createBlock('transition', segment);
    }
    if (/^\[备注\]/.test(segment)) {
      return createBlock('note', segment.replace(/^\[备注\]\s*/, ''));
    }
    return createBlock('action', segment);
  });
}

function serializeBlocks(blocks: ScreenplayBlock[]) {
  return blocks
    .map((block) => {
      const text = block.text.trim();
      if (!text && block.type !== 'transition') return '';
      switch (block.type) {
        case 'scene-heading':
          return normalizeSceneHeading(text);
        case 'character':
          return `**${text}**`;
        case 'dialogue':
          return `> ${text}`;
        case 'transition':
          return text || '---';
        case 'note':
          return `[备注] ${text}`;
        default:
          return text;
      }
    })
    .filter(Boolean)
    .join('\n\n');
}

function syncBlocksFromContent(raw: string) {
  screenplayBlocks.value = parseContentToBlocks(raw);
  if (!selectedBlockId.value && screenplayBlocks.value.length) {
    selectedBlockId.value = screenplayBlocks.value[0].id;
  }
}

async function loadWorkbench() {
  loading.value = true;
  try {
    const [editorResponse, versionsResponse] = await Promise.all([
      apiService.getPipelineEditor(taskId),
      apiService.getPipelineVersions(taskId),
    ]);
    title.value = editorResponse.data?.title || '';
    content.value = editorResponse.data?.content || '';
    syncBlocksFromContent(content.value);
    sourceVersionId.value = editorResponse.data?.draft?.source_version_id || editorResponse.data?.sourceVersion?.id || null;
    versions.value = versionsResponse.data?.versions || [];
    compareBaseId.value = versions.value[1]?.id || versions.value[0]?.id || null;
    compareTargetId.value = versions.value[0]?.id || null;
  } catch (error: any) {
    toast.error(error.message || '加载编辑工作台失败');
  } finally {
    loading.value = false;
  }
}

async function saveDraft() {
  saving.value = true;
  autosaveState.value = 'saving';
  try {
    await apiService.savePipelineDraft(taskId, {
      title: title.value,
      content: content.value,
      sourceVersionId: sourceVersionId.value,
    });
    autosaveState.value = 'saved';
  } catch (error: any) {
    toast.error(error.message || '保存草稿失败');
  } finally {
    saving.value = false;
  }
}

watch([title, content], () => {
  if (loading.value) return;
  autosaveState.value = 'idle';
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    void saveDraft();
  }, 1500);
});

watch(screenplayBlocks, (blocks) => {
  content.value = serializeBlocks(blocks);
}, { deep: true });

async function publishVersion() {
  publishing.value = true;
  try {
    const response = await apiService.publishPipelineDraft(taskId, {
      label: `编辑发布 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      content: content.value,
      changeNotes: '来自企业编辑工作台',
    });
    toast.success('已发布新版本');
    sourceVersionId.value = response.data?.version?.id || sourceVersionId.value;
    await loadWorkbench();
  } catch (error: any) {
    toast.error(error.message || '发布版本失败');
  } finally {
    publishing.value = false;
  }
}

async function compareVersions() {
  if (!compareBaseId.value || !compareTargetId.value) return;
  try {
    const response = await apiService.comparePipelineVersions(taskId, {
      baseVersionId: compareBaseId.value,
      targetVersionId: compareTargetId.value,
    });
    compareResult.value = response.data || null;
  } catch (error: any) {
    toast.error(error.message || '版本对比失败');
  }
}

function jumpToScene(blockId: string) {
  selectedBlockId.value = blockId;
}

function addBlock(type: ScreenplayBlockType = 'action', afterIndex?: number) {
  const nextBlocks = [...screenplayBlocks.value];
  const block = createBlock(type, type === 'scene-heading' ? '## 新场景' : '');
  const insertAt = typeof afterIndex === 'number' ? afterIndex + 1 : nextBlocks.length;
  nextBlocks.splice(insertAt, 0, block);
  screenplayBlocks.value = nextBlocks;
  selectedBlockId.value = block.id;
}

function insertSceneHeadingPreset(preset: string, afterIndex?: number) {
  const nextBlocks = [...screenplayBlocks.value];
  const block = createBlock('scene-heading', preset);
  const insertAt = typeof afterIndex === 'number' ? afterIndex + 1 : nextBlocks.length;
  nextBlocks.splice(insertAt, 0, block);
  screenplayBlocks.value = nextBlocks;
  selectedBlockId.value = block.id;
}

function insertCharacterDialoguePair(index: number) {
  const nextBlocks = [...screenplayBlocks.value];
  const characterBlock = createBlock('character', '角色名');
  const dialogueBlock = createBlock('dialogue', '对白内容');
  nextBlocks.splice(index + 1, 0, characterBlock, dialogueBlock);
  screenplayBlocks.value = nextBlocks;
  selectedBlockId.value = characterBlock.id;
}

function insertSceneBundle(index?: number) {
  const nextBlocks = [...screenplayBlocks.value];
  const bundle = [
    createBlock('scene-heading', '## 新场景'),
    createBlock('action', '输入该场景的动作与调度...'),
    createBlock('character', '角色名'),
    createBlock('dialogue', '对白内容'),
  ];
  const insertAt = typeof index === 'number' ? index + 1 : nextBlocks.length;
  nextBlocks.splice(insertAt, 0, ...bundle);
  screenplayBlocks.value = nextBlocks;
  selectedBlockId.value = bundle[0].id;
}

function removeBlock(index: number) {
  const nextBlocks = [...screenplayBlocks.value];
  const [removed] = nextBlocks.splice(index, 1);
  screenplayBlocks.value = nextBlocks.length ? nextBlocks : [createBlock('action', '')];
  if (selectedBlockId.value === removed?.id) {
    selectedBlockId.value = screenplayBlocks.value[Math.max(0, index - 1)]?.id || screenplayBlocks.value[0]?.id || null;
  }
}

function duplicateBlock(index: number) {
  const source = screenplayBlocks.value[index];
  if (!source) return;
  addBlock(source.type, index);
  screenplayBlocks.value[index + 1].text = source.text;
}

function moveBlock(index: number, direction: -1 | 1) {
  const nextIndex = index + direction;
  if (nextIndex < 0 || nextIndex >= screenplayBlocks.value.length) return;
  const nextBlocks = [...screenplayBlocks.value];
  [nextBlocks[index], nextBlocks[nextIndex]] = [nextBlocks[nextIndex], nextBlocks[index]];
  screenplayBlocks.value = nextBlocks;
}

function blockTypeMeta(type: ScreenplayBlockType) {
  return blockTypeOptions.find((item) => item.value === type) || blockTypeOptions[0];
}

onMounted(loadWorkbench);
</script>

<template>
  <div class="p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <RouterLink :to="`/pipeline/${taskId}`" class="text-sm text-[#737373] hover:text-white transition-colors">← 返回流水线</RouterLink>
            <span class="text-[11px] px-2 py-1 rounded bg-[#2563EB]/10 text-[#93C5FD]">企业编辑工作台</span>
          </div>
          <h1 class="text-lg font-semibold text-white">剧本编辑与版本管理</h1>
          <p class="text-sm text-[#737373] mt-1">支持自动保存草稿、发布版本和版本间差异对比。</p>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span :class="autosaveState === 'saving' ? 'text-amber-300' : autosaveState === 'saved' ? 'text-emerald-300' : 'text-[#737373]'">
            {{ autosaveState === 'saving' ? '自动保存中...' : autosaveState === 'saved' ? '草稿已保存' : '待保存' }}
          </span>
          <button class="btn-secondary text-sm" :disabled="saving" @click="saveDraft">手动保存</button>
          <button class="btn-primary text-sm" :disabled="publishing" @click="publishVersion">{{ publishing ? '发布中...' : '发布为新版本' }}</button>
        </div>
      </div>

      <div v-if="loading" class="card text-sm text-[#737373]">加载中...</div>

      <template v-else>
        <div class="grid xl:grid-cols-[240px,1fr,360px] gap-6">
          <div class="space-y-4">
            <div class="card !p-4">
              <div class="flex items-center justify-between mb-3">
                <div class="text-sm font-medium text-white">场景导航</div>
                <div class="text-[11px] text-[#737373]">{{ sceneNavigator.length }} 项</div>
              </div>
              <div v-if="!sceneNavigator.length" class="text-xs text-[#737373] leading-6">当前内容还未形成可识别的场景标题，可直接在编辑区输入 `## 场景 1` 或 `**INT. ...**`。</div>
              <div v-else class="space-y-2 max-h-[720px] overflow-auto pr-1">
                <button
                  v-for="item in sceneNavigator"
                  :key="item.id"
                  type="button"
                  @click="jumpToScene(item.id)"
                  :class="selectedBlockId === item.id ? 'w-full text-left rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 px-3 py-2' : 'w-full text-left rounded-lg border border-[#2F2F2F] bg-[#202020] px-3 py-2 hover:border-[#404040] transition-colors'"
                >
                  <div class="flex items-center gap-2 mb-1">
                    <span :class="item.type === 'scene' ? 'px-1.5 py-0.5 rounded bg-[#2563EB]/10 text-[#93C5FD] text-[10px]' : 'px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 text-[10px]'">
                      {{ item.type === 'scene' ? 'Scene' : 'Heading' }}
                    </span>
                    <span class="text-[10px] text-[#737373]">#{{ item.index + 1 }}</span>
                  </div>
                  <div class="text-xs text-[#E5E5E5] truncate">{{ item.label }}</div>
                </button>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="card !p-4">
              <div class="text-xs text-[#737373] mb-1">剧本标题</div>
              <input v-model="title" class="input-field" />
            </div>
            <div class="card !p-0 overflow-hidden">
              <div class="grid lg:grid-cols-[1fr,320px] min-h-[680px]">
                <div class="bg-[#171717] border-r border-[#2F2F2F] p-4 overflow-auto space-y-3">
                  <div class="flex items-center justify-between mb-2">
                    <div class="text-sm font-medium text-white">剧本块编辑器</div>
                    <div class="flex items-center gap-2">
                      <button class="btn-secondary text-xs" @click="insertSceneBundle()">新建场景包</button>
                      <button class="btn-secondary text-xs" @click="addBlock('action')">新增块</button>
                    </div>
                  </div>
                  <div class="rounded-xl border border-[#2F2F2F] bg-[#202020] p-3">
                    <div class="text-[11px] text-[#737373] mb-2">场景标题快捷模板</div>
                    <div class="flex flex-wrap gap-2">
                      <button v-for="preset in sceneHeadingPresets" :key="preset" class="px-2 py-1 rounded-lg border border-[#2F2F2F] text-xs text-[#D4D4D4] hover:border-[#404040]" @click="insertSceneHeadingPreset(preset)">
                        {{ preset }}
                      </button>
                    </div>
                  </div>
                  <div
                    v-for="(block, index) in screenplayBlocks"
                    :key="block.id"
                    :class="selectedBlockId === block.id ? 'rounded-xl border border-[#2563EB]/40 bg-[#2563EB]/5 p-4' : 'rounded-xl border border-[#2F2F2F] bg-[#202020] p-4'"
                    @click="selectedBlockId = block.id"
                  >
                    <div class="flex items-center gap-2 mb-3">
                      <select v-model="block.type" class="input-field !py-1.5 !text-xs max-w-[160px]">
                        <option v-for="option in blockTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
                      </select>
                      <span class="text-[11px] text-[#737373] truncate">{{ blockTypeMeta(block.type).hint }}</span>
                    </div>
                    <textarea
                      v-model="block.text"
                      :rows="block.type === 'action' || block.type === 'dialogue' ? 4 : 2"
                      class="input-field !min-h-0 w-full resize-y font-mono text-sm leading-6"
                      :placeholder="block.type === 'scene-heading' ? '输入场景标题或 INT./EXT.' : block.type === 'character' ? '输入角色名' : block.type === 'dialogue' ? '输入对白内容' : block.type === 'transition' ? '输入转场，如 CUT TO:' : block.type === 'note' ? '输入制作备注' : '输入动作描述'"
                    ></textarea>
                    <div class="flex flex-wrap gap-2 mt-3">
                      <button v-if="block.type === 'character'" class="btn-secondary text-xs" @click.stop="insertCharacterDialoguePair(index)">插入角色+对白</button>
                      <button v-if="block.type === 'scene-heading'" class="btn-secondary text-xs" @click.stop="insertSceneBundle(index)">插入完整场景包</button>
                      <button class="btn-secondary text-xs" @click.stop="moveBlock(index, -1)">上移</button>
                      <button class="btn-secondary text-xs" @click.stop="moveBlock(index, 1)">下移</button>
                      <button class="btn-secondary text-xs" @click.stop="duplicateBlock(index)">复制</button>
                      <button class="btn-secondary text-xs" @click.stop="addBlock(block.type, index)">下方新增</button>
                      <button class="btn-secondary text-xs text-red-300" @click.stop="removeBlock(index)">删除</button>
                    </div>
                  </div>
                </div>
                <div class="bg-[#141414] p-4 overflow-auto">
                  <div class="flex items-center justify-between mb-3">
                    <div class="text-sm font-medium text-white">结构预览</div>
                    <div class="text-[11px] text-[#737373]">只读</div>
                  </div>
                  <pre class="whitespace-pre-wrap text-xs leading-6 text-[#A3A3A3] font-mono">{{ content }}</pre>
                </div>
              </div>
            </div>
          </div>

          <div class="space-y-4">
            <div class="card !p-4">
              <div class="text-sm font-medium text-white mb-3">版本时间线</div>
              <div class="space-y-2 max-h-[280px] overflow-auto pr-1">
                <div v-for="version in versions" :key="version.id" class="rounded-lg border border-[#2F2F2F] bg-[#202020] p-3">
                  <div class="text-sm text-white">v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}</div>
                  <div class="text-[11px] text-[#737373] mt-1">{{ new Date(version.created_at).toLocaleString('zh-CN') }}</div>
                  <div v-if="version.change_notes" class="text-xs text-[#A3A3A3] mt-2 whitespace-pre-wrap">{{ version.change_notes }}</div>
                </div>
              </div>
            </div>

            <div class="card !p-4 space-y-3">
              <div class="text-sm font-medium text-white">版本对比</div>
              <select v-model="compareBaseId" class="input-field">
                <option :value="null">选择基准版本</option>
                <option v-for="version in versions" :key="`base-${version.id}`" :value="version.id">v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}</option>
              </select>
              <select v-model="compareTargetId" class="input-field">
                <option :value="null">选择对比版本</option>
                <option v-for="version in versions" :key="`target-${version.id}`" :value="version.id">v{{ version.version }} · {{ version.label || `版本 ${version.version}` }}</option>
              </select>
              <button class="btn-secondary text-sm w-full" @click="compareVersions">开始对比</button>
            </div>
          </div>
        </div>

        <div v-if="compareResult" class="card !p-4">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="text-sm font-medium text-white">版本差异</div>
              <div class="text-xs text-[#737373] mt-1">左侧为基准版本，右侧为目标版本</div>
            </div>
          </div>
          <div class="rounded-xl border border-[#2F2F2F] overflow-hidden">
            <div class="grid grid-cols-2 bg-[#202020] text-xs text-[#737373]">
              <div class="px-4 py-2 border-r border-[#2F2F2F]">{{ compareResult.baseVersion?.label || '基准版本' }}</div>
              <div class="px-4 py-2">{{ compareResult.targetVersion?.label || '目标版本' }}</div>
            </div>
            <div class="max-h-[420px] overflow-auto font-mono text-xs">
              <div v-for="row in diffRows" :key="row.lineNumber" class="grid grid-cols-2 border-t border-[#1F1F1F]">
                <div :class="row.type === 'removed' || row.type === 'changed' ? 'bg-red-500/10 text-red-200 px-4 py-2 whitespace-pre-wrap' : 'px-4 py-2 text-[#D4D4D4] whitespace-pre-wrap'">{{ row.baseLine || '' }}</div>
                <div :class="row.type === 'added' || row.type === 'changed' ? 'bg-emerald-500/10 text-emerald-200 px-4 py-2 whitespace-pre-wrap border-l border-[#2F2F2F]' : 'px-4 py-2 text-[#D4D4D4] whitespace-pre-wrap border-l border-[#2F2F2F]'">{{ row.targetLine || '' }}</div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
