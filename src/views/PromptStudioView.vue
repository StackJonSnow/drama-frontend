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
const modalOpen = ref(false);
const inspectedVersionId = ref<number | null>(null);
const publishTag = ref<'production' | 'staging' | 'draft'>('production');

const groupedTemplates = computed(() => {
  const map = new Map<string, any[]>();
  for (const template of templates.value) {
    const list = map.get(template.node_key) || [];
    list.push(template);
    map.set(template.node_key, list);
  }
  return Array.from(map.entries()).map(([nodeKey, versions]) => ({ nodeKey, versions }));
});

const activeGroup = computed(() => groupedTemplates.value.find((group) => group.nodeKey === selectedNodeKey.value) || null);
const inspectedVersion = computed(() => activeGroup.value?.versions.find((item: any) => item.id === inspectedVersionId.value) || null);

function pickActiveTemplate(nodeKey: string) {
  const versions = templates.value.filter((item) => item.node_key === nodeKey);
  return versions.find((item) => !item.is_system) || versions.find((item) => item.is_system) || null;
}

function loadEditor(nodeKey: string) {
  selectedNodeKey.value = nodeKey;
  const template = pickActiveTemplate(nodeKey);
  editor.value = template ? JSON.parse(JSON.stringify(template)) : null;
  inspectedVersionId.value = template?.id || null;
  modalOpen.value = Boolean(editor.value);
}

function closeModal() {
  modalOpen.value = false;
}

function displayTemplateName(name?: string) {
  return (name || '').replace(/^企业级/, '').trim() || '未命名模板';
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
      name: displayTemplateName(editor.value.name),
      description: editor.value.description,
      system_prompt: editor.value.system_prompt,
      task_instruction: editor.value.task_instruction,
      extra_rules: editor.value.extra_rules || [],
      model_config: editor.value.model_config || {},
    });
    toast.success('提示词模板已保存');
    await loadTemplates();
    modalOpen.value = false;
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
    modalOpen.value = false;
  } catch (error: any) {
    toast.error(error.message || '重置模板失败');
  }
}

function addRule() {
  if (!editor.value) return;
  editor.value.extra_rules = [...(editor.value.extra_rules || []), ''];
}

function inspectVersion(versionId: number) {
  inspectedVersionId.value = versionId;
}

function fieldChanged(currentValue: unknown, inspectedValue: unknown) {
  return JSON.stringify(currentValue ?? '') !== JSON.stringify(inspectedValue ?? '');
}

async function publishTemplate() {
  if (!inspectedVersionId.value) return;
  saving.value = true;
  try {
    const response = await apiService.publishPromptTemplate(selectedNodeKey.value, {
      templateId: inspectedVersionId.value,
      releaseTag: publishTag.value,
    });
    templates.value = response.data?.templates || templates.value;
    toast.success('模板已发布');
    loadEditor(selectedNodeKey.value);
  } catch (error: any) {
    toast.error(error.message || '发布模板失败');
  } finally {
    saving.value = false;
  }
}

async function rollbackTemplate() {
  if (!inspectedVersionId.value) return;
  saving.value = true;
  try {
    const response = await apiService.rollbackPromptTemplate(selectedNodeKey.value, {
      templateId: inspectedVersionId.value,
    });
    templates.value = response.data?.templates || templates.value;
    toast.success('已回滚到所选版本');
    loadEditor(selectedNodeKey.value);
  } catch (error: any) {
    toast.error(error.message || '回滚失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadTemplates);
</script>

<template>
  <div class="p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 class="text-lg font-semibold text-white">提示词模板中心</h1>
        <p class="text-sm text-[#737373] mt-1">管理各个流水线节点的提示词模板、规则和模型参数。</p>
      </div>

      <div class="card !p-4 space-y-3">
        <div class="text-sm font-medium text-white">节点模板</div>
        <div v-if="loading" class="text-sm text-[#737373]">加载中...</div>
        <div class="grid lg:grid-cols-2 xl:grid-cols-3 gap-3">
          <button
            v-for="group in groupedTemplates"
            :key="group.nodeKey"
            type="button"
            @click="loadEditor(group.nodeKey)"
            :class="selectedNodeKey === group.nodeKey ? 'text-left rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 p-4' : 'text-left rounded-lg border border-[#2F2F2F] bg-[#202020] p-4 hover:border-[#404040]'"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-sm text-white">{{ displayTemplateName(group.versions[0]?.name || group.nodeKey) }}</span>
              <span class="text-[10px] text-[#737373]">{{ group.nodeKey }}</span>
            </div>
            <div class="text-xs text-[#737373] line-clamp-2 mb-2">{{ group.versions[0]?.description || '无描述' }}</div>
            <div class="text-[11px] text-[#A78BFA]">点击配置</div>
          </button>
        </div>
      </div>

      <Teleport to="body">
        <div v-if="modalOpen && editor" class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeModal"></div>
          <div class="relative w-full max-w-6xl rounded-3xl border border-[#2F2F2F] bg-[#171717] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
            <div class="px-6 py-5 border-b border-[#2F2F2F] flex items-start justify-between gap-4">
              <div>
                <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-2">节点模板</div>
                <h3 class="text-2xl font-semibold text-white">{{ displayTemplateName(editor.name) }}</h3>
                <p class="text-sm text-[#8E8E8E] mt-2">{{ selectedNodeKey }}</p>
              </div>
              <button @click="closeModal" class="w-9 h-9 rounded-full border border-[#2F2F2F] text-[#A3A3A3] hover:text-white hover:border-[#404040] transition-colors">×</button>
            </div>

            <div class="p-6 overflow-auto">
              <div class="grid xl:grid-cols-[260px,1fr] gap-6" v-if="editor">
                <div class="card !p-4 h-fit">
                  <div class="flex items-center justify-between mb-3">
                    <div class="text-sm font-medium text-white">版本历史</div>
                    <div class="text-[11px] text-[#737373]">{{ activeGroup?.versions.length || 0 }} 个版本</div>
                  </div>
                  <div class="space-y-2 max-h-[65vh] overflow-auto pr-1">
                      <button
                        v-for="version in activeGroup?.versions || []"
                        :key="version.id"
                      type="button"
                      @click="inspectVersion(version.id)"
                      :class="inspectedVersionId === version.id ? 'w-full text-left rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 p-3' : 'w-full text-left rounded-lg border border-[#2F2F2F] bg-[#202020] p-3 hover:border-[#404040]'"
                    >
                      <div class="flex items-center justify-between gap-2 mb-1">
                        <span class="text-sm text-white">v{{ version.version }}</span>
                        <span v-if="version.is_system" class="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 text-[10px]">系统</span>
                        <span v-else class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">覆盖</span>
                      </div>
                      <div class="text-xs text-[#A3A3A3] mb-1">{{ displayTemplateName(version.name) }}</div>
                      <div class="flex items-center gap-2 mb-1">
                        <span class="px-1.5 py-0.5 rounded bg-[#2F2F2F] text-[10px] text-[#D4D4D4]">{{ version.release_tag || 'draft' }}</span>
                        <span v-if="version.is_active" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">当前生效</span>
                      </div>
                      <div class="text-[11px] text-[#737373] line-clamp-2">{{ version.description || '无描述' }}</div>
                    </button>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="card !p-5">
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

                    <div class="grid xl:grid-cols-2 gap-4 mb-4">
                      <label class="block">
                        <div class="text-xs text-[#737373] mb-1">System Prompt</div>
                        <textarea v-model="editor.system_prompt" rows="10" :class="fieldChanged(editor.system_prompt, inspectedVersion?.system_prompt) ? 'input-field border-amber-500/40 bg-amber-500/5' : 'input-field'"></textarea>
                      </label>
                      <label class="block">
                        <div class="text-xs text-[#737373] mb-1">当前查看版本 System Prompt</div>
                        <textarea :value="inspectedVersion?.system_prompt || ''" rows="10" class="input-field opacity-80" readonly></textarea>
                      </label>
                    </div>

                    <div class="grid xl:grid-cols-2 gap-4 mb-4">
                      <label class="block">
                        <div class="text-xs text-[#737373] mb-1">任务指令</div>
                        <textarea v-model="editor.task_instruction" rows="6" :class="fieldChanged(editor.task_instruction, inspectedVersion?.task_instruction) ? 'input-field border-amber-500/40 bg-amber-500/5' : 'input-field'"></textarea>
                      </label>
                      <label class="block">
                        <div class="text-xs text-[#737373] mb-1">当前查看版本任务指令</div>
                        <textarea :value="inspectedVersion?.task_instruction || ''" rows="6" class="input-field opacity-80" readonly></textarea>
                      </label>
                    </div>

                    <div class="mb-4">
                      <div class="flex items-center justify-between mb-2">
                        <div class="text-xs text-[#737373]">附加规则</div>
                        <button class="btn-secondary text-xs" @click="addRule">新增规则</button>
                      </div>
                      <div class="grid xl:grid-cols-2 gap-4">
                        <div class="space-y-2">
                          <input v-for="(_, index) in editor.extra_rules" :key="index" v-model="editor.extra_rules[index]" :class="fieldChanged(editor.extra_rules[index], inspectedVersion?.extra_rules?.[index]) ? 'input-field border-amber-500/40 bg-amber-500/5' : 'input-field'" />
                        </div>
                        <div class="rounded-xl border border-[#2F2F2F] bg-[#111111] p-3">
                          <div class="text-[11px] text-[#737373] mb-2">当前查看版本规则</div>
                          <ul class="space-y-2 text-sm text-[#D4D4D4] list-disc pl-4">
                            <li v-for="(rule, index) in inspectedVersion?.extra_rules || []" :key="index">{{ rule }}</li>
                            <li v-if="!(inspectedVersion?.extra_rules || []).length" class="list-none text-[#525252] pl-0">无规则</li>
                          </ul>
                        </div>
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

                    <div class="flex items-center justify-between gap-4">
                      <div class="flex items-center gap-2">
                        <select v-model="publishTag" class="input-field !w-[140px]">
                          <option value="production">production</option>
                          <option value="staging">staging</option>
                          <option value="draft">draft</option>
                        </select>
                        <button class="btn-secondary text-sm" :disabled="saving || !inspectedVersionId" @click="publishTemplate">发布所选版本</button>
                        <button class="btn-secondary text-sm" :disabled="saving || !inspectedVersionId" @click="rollbackTemplate">回滚到所选版本</button>
                      </div>
                      <div class="flex justify-end gap-2">
                      <button class="btn-secondary text-sm" @click="resetTemplate">重置为系统模板</button>
                      <button class="btn-primary text-sm" :disabled="saving" @click="saveTemplate">{{ saving ? '保存中...' : '保存模板' }}</button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>
