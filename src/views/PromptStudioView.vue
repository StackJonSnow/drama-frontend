<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import apiService from '@/services/api';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const loading = ref(true);
const saving = ref(false);
const templates = ref<any[]>([]);
const selectedNodeKey = ref('story_outline');
const editor = ref<any | null>(null);

const groupedTemplates = computed(() => {
  const map = new Map<string, any[]>();
  for (const template of templates.value) {
    const list = map.get(template.node_key) || [];
    list.push(template);
    map.set(template.node_key, list);
  }
  return Array.from(map.entries()).map(([nodeKey, versions]) => ({ nodeKey, versions }));
});

function pickActiveTemplate(nodeKey: string) {
  const versions = templates.value.filter((item) => item.node_key === nodeKey);
  return versions.find((item) => !item.is_system) || versions.find((item) => item.is_system) || null;
}

function loadEditor(nodeKey: string) {
  selectedNodeKey.value = nodeKey;
  const template = pickActiveTemplate(nodeKey);
  editor.value = template ? JSON.parse(JSON.stringify(template)) : null;
}

async function loadTemplates() {
  loading.value = true;
  try {
    const response = await apiService.getPromptTemplates();
    templates.value = response.data?.templates || [];
    if (templates.value.length) {
      loadEditor(selectedNodeKey.value || templates.value[0].node_key);
    }
  } catch (error: any) {
    toast.error(error.message || '加载提示词模板失败');
  } finally {
    loading.value = false;
  }
}

async function saveTemplate() {
  if (!editor.value) return;
  saving.value = true;
  try {
    await apiService.updatePromptTemplate(selectedNodeKey.value, {
      name: editor.value.name,
      description: editor.value.description,
      system_prompt: editor.value.system_prompt,
      task_instruction: editor.value.task_instruction,
      extra_rules: editor.value.extra_rules || [],
      model_config: editor.value.model_config || {},
    });
    toast.success('提示词模板已保存');
    await loadTemplates();
  } catch (error: any) {
    toast.error(error.message || '保存模板失败');
  } finally {
    saving.value = false;
  }
}

async function resetTemplate() {
  try {
    await apiService.resetPromptTemplate(selectedNodeKey.value);
    toast.success('已重置为企业默认模板');
    await loadTemplates();
  } catch (error: any) {
    toast.error(error.message || '重置模板失败');
  }
}

function addRule() {
  if (!editor.value) return;
  editor.value.extra_rules = [...(editor.value.extra_rules || []), ''];
}

onMounted(loadTemplates);
</script>

<template>
  <div class="p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 class="text-lg font-semibold text-white">提示词模板中心</h1>
        <p class="text-sm text-[#737373] mt-1">管理各个流水线节点的企业级提示词模板、规则和模型参数。</p>
      </div>

      <div class="grid lg:grid-cols-[280px,1fr] gap-6">
        <div class="card !p-4 space-y-3">
          <div class="text-sm font-medium text-white">节点模板</div>
          <div v-if="loading" class="text-sm text-[#737373]">加载中...</div>
          <button
            v-for="group in groupedTemplates"
            :key="group.nodeKey"
            type="button"
            @click="loadEditor(group.nodeKey)"
            :class="selectedNodeKey === group.nodeKey ? 'w-full text-left rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 p-3' : 'w-full text-left rounded-lg border border-[#2F2F2F] bg-[#202020] p-3 hover:border-[#404040]'"
          >
            <div class="flex items-center justify-between gap-2 mb-1">
              <span class="text-sm text-white">{{ group.versions[0]?.name || group.nodeKey }}</span>
              <span class="text-[10px] text-[#737373]">{{ group.nodeKey }}</span>
            </div>
            <div class="text-xs text-[#737373] line-clamp-2">{{ group.versions[0]?.description || '无描述' }}</div>
          </button>
        </div>

        <div class="card !p-5" v-if="editor">
          <div class="flex items-center justify-between gap-4 mb-5">
            <div>
              <div class="text-xs text-[#737373] mb-1">节点键</div>
              <div class="text-white font-medium">{{ selectedNodeKey }}</div>
            </div>
            <div class="flex items-center gap-2">
              <span v-if="editor.is_system" class="px-2 py-1 rounded bg-violet-500/10 text-violet-300 text-xs">系统基线</span>
              <span v-if="!editor.is_system" class="px-2 py-1 rounded bg-emerald-500/10 text-emerald-300 text-xs">自定义覆盖</span>
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mb-4">
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">模板名称</div>
              <input v-model="editor.name" class="input-field" />
            </label>
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">描述</div>
              <input v-model="editor.description" class="input-field" />
            </label>
          </div>

          <label class="block mb-4">
            <div class="text-xs text-[#737373] mb-1">System Prompt</div>
            <textarea v-model="editor.system_prompt" rows="6" class="input-field"></textarea>
          </label>

          <label class="block mb-4">
            <div class="text-xs text-[#737373] mb-1">任务指令</div>
            <textarea v-model="editor.task_instruction" rows="4" class="input-field"></textarea>
          </label>

          <div class="mb-4">
            <div class="flex items-center justify-between mb-2">
              <div class="text-xs text-[#737373]">附加规则</div>
              <button class="btn-secondary text-xs" @click="addRule">新增规则</button>
            </div>
            <div class="space-y-2">
              <input v-for="(_, index) in editor.extra_rules" :key="index" v-model="editor.extra_rules[index]" class="input-field" />
            </div>
          </div>

          <div class="grid md:grid-cols-2 gap-4 mb-6">
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">Temperature</div>
              <input v-model.number="editor.model_config.temperature" type="number" step="0.1" min="0" max="1.5" class="input-field" />
            </label>
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">Max Tokens</div>
              <input v-model.number="editor.model_config.maxTokens" type="number" min="256" max="8192" class="input-field" />
            </label>
          </div>

          <div class="flex justify-end gap-2">
            <button class="btn-secondary text-sm" @click="resetTemplate">重置为系统模板</button>
            <button class="btn-primary text-sm" :disabled="saving" @click="saveTemplate">{{ saving ? '保存中...' : '保存模板' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
