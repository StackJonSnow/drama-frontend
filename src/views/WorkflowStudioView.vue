<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import apiService from '@/services/api';
import { useToast } from '@/composables/useToast';

const toast = useToast();
const loading = ref(true);
const saving = ref(false);
const templates = ref<any[]>([]);
const selectedTemplateId = ref<number | null>(null);
const editor = ref<any | null>(null);
const draggingNodeIndex = ref<number | null>(null);

const selectedTemplate = computed(() => templates.value.find((item) => item.id === selectedTemplateId.value) || null);

async function loadTemplates() {
  loading.value = true;
  try {
    const response = await apiService.getWorkflowTemplates();
    templates.value = response.data?.templates || [];
    if (!selectedTemplateId.value && templates.value.length) {
      const firstId = Number(templates.value[0].id);
      selectedTemplateId.value = firstId;
      await loadTemplateDetail(firstId);
    }
  } catch (error: any) {
    toast.error(error.message || '加载工作流失败');
  } finally {
    loading.value = false;
  }
}

async function loadTemplateDetail(id: number) {
  const response = await apiService.getWorkflowTemplate(id);
  editor.value = JSON.parse(JSON.stringify(response.data?.template || null));
  selectedTemplateId.value = id;
}

function moveNode(index: number, direction: -1 | 1) {
  if (!editor.value) return;
  const next = index + direction;
  if (next < 0 || next >= editor.value.nodes.length) return;
  const nodes = [...editor.value.nodes];
  [nodes[index], nodes[next]] = [nodes[next], nodes[index]];
  editor.value.nodes = nodes.map((node, nodeIndex) => ({ ...node, execution_order: nodeIndex + 1 }));
}

function reorderNodes(fromIndex: number, toIndex: number) {
  if (!editor.value || fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
  const nodes = [...editor.value.nodes];
  const [moved] = nodes.splice(fromIndex, 1);
  nodes.splice(toIndex, 0, moved);
  editor.value.nodes = nodes.map((node, nodeIndex) => ({ ...node, execution_order: nodeIndex + 1 }));
}

function handleDragStart(index: number) {
  draggingNodeIndex.value = index;
}

function handleDrop(index: number) {
  if (draggingNodeIndex.value == null) return;
  reorderNodes(draggingNodeIndex.value, index);
  draggingNodeIndex.value = null;
}

function handleDragEnd() {
  draggingNodeIndex.value = null;
}

function createWorkflowCopy() {
  const base = editor.value || selectedTemplate.value;
  if (!base) return;
  editor.value = {
    ...JSON.parse(JSON.stringify(base)),
    id: null,
    name: `${base.name} · 副本`,
    description: base.description || '',
    is_default: false,
    is_system: false,
  };
}

async function saveWorkflow() {
  if (!editor.value) return;
  saving.value = true;
  try {
    const payload = {
      name: editor.value.name,
      description: editor.value.description,
      is_default: Boolean(editor.value.is_default),
      nodes: editor.value.nodes,
    };
    if (editor.value.id && !editor.value.is_system) {
      await apiService.updateWorkflowTemplate(editor.value.id, payload);
      toast.success('工作流已更新');
    } else {
      const response = await apiService.createWorkflowTemplate(payload);
      toast.success('工作流已创建');
      selectedTemplateId.value = response.data?.template?.id || null;
    }
    await loadTemplates();
    if (selectedTemplateId.value) await loadTemplateDetail(selectedTemplateId.value);
  } catch (error: any) {
    toast.error(error.message || '保存工作流失败');
  } finally {
    saving.value = false;
  }
}

onMounted(loadTemplates);
</script>

<template>
  <div class="p-6">
    <div class="max-w-7xl mx-auto space-y-6">
      <div class="flex items-start justify-between gap-4">
        <div>
          <h1 class="text-lg font-semibold text-white">流程编排工作台</h1>
          <p class="text-sm text-[#737373] mt-1">管理企业级生成流水线，调整节点顺序、启停和元信息配置。</p>
        </div>
        <button class="btn-secondary text-sm" @click="createWorkflowCopy">从当前模板创建副本</button>
      </div>

      <div class="grid lg:grid-cols-[280px,1fr] gap-6">
        <div class="card !p-4 space-y-3">
          <div class="text-sm font-medium text-white">工作流模板</div>
          <div v-if="loading" class="text-sm text-[#737373]">加载中...</div>
          <button
            v-for="template in templates"
            :key="template.id"
            type="button"
            @click="loadTemplateDetail(template.id)"
            :class="selectedTemplateId === template.id ? 'w-full text-left rounded-lg border border-[#2563EB]/40 bg-[#2563EB]/10 p-3' : 'w-full text-left rounded-lg border border-[#2F2F2F] bg-[#202020] p-3 hover:border-[#404040]'"
          >
            <div class="flex items-center gap-2 mb-1">
              <span class="text-sm text-white">{{ template.name }}</span>
              <span v-if="template.is_system" class="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-300 text-[10px]">系统</span>
              <span v-if="template.is_default" class="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-300 text-[10px]">默认</span>
            </div>
            <div class="text-xs text-[#737373] leading-5">{{ template.description || '无描述' }}</div>
          </button>
        </div>

        <div class="card !p-5" v-if="editor">
          <div class="grid md:grid-cols-2 gap-4 mb-5">
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">模板名称</div>
              <input v-model="editor.name" class="input-field" />
            </label>
            <label class="block">
              <div class="text-xs text-[#737373] mb-1">描述</div>
              <input v-model="editor.description" class="input-field" />
            </label>
          </div>
          <label class="inline-flex items-center gap-2 text-sm text-[#A3A3A3] mb-5">
            <input v-model="editor.is_default" type="checkbox" class="rounded border-[#404040] bg-[#202020]" />
            设为当前账户默认工作流
          </label>

          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="text-sm font-medium text-white">节点编排</div>
              <div class="text-xs text-[#737373]">企业建议：保持依赖顺序有效</div>
            </div>
            <div
              v-for="(node, index) in editor.nodes"
              :key="node.step_number"
              draggable="true"
              @dragstart="handleDragStart(Number(index))"
              @dragover.prevent
              @drop="handleDrop(Number(index))"
              @dragend="handleDragEnd"
              :class="draggingNodeIndex === Number(index) ? 'rounded-xl border border-[#2563EB]/40 bg-[#2563EB]/5 p-4 opacity-70' : 'rounded-xl border border-[#2F2F2F] bg-[#202020] p-4'"
            >
              <div class="flex items-start justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 mb-2">
                    <span class="cursor-grab text-[#737373] text-sm">⋮⋮</span>
                    <span class="px-2 py-0.5 rounded bg-[#2F2F2F] text-xs text-[#D4D4D4]">#{{ node.execution_order }}</span>
                    <input v-model="node.display_name" class="bg-transparent text-white font-medium outline-none w-full" />
                    <label class="inline-flex items-center gap-2 text-xs text-[#A3A3A3] whitespace-nowrap">
                      <input v-model="node.enabled" type="checkbox" class="rounded border-[#404040] bg-[#202020]" /> 启用
                    </label>
                  </div>
                  <div class="grid md:grid-cols-2 gap-3">
                    <label class="block">
                      <div class="text-[11px] text-[#737373] mb-1">分类</div>
                      <input v-model="node.metadata.category" class="input-field" />
                    </label>
                    <label class="block">
                      <div class="text-[11px] text-[#737373] mb-1">绑定提示词节点</div>
                      <input v-model="node.metadata.promptNodeKey" class="input-field" />
                    </label>
                  </div>
                  <label class="block mt-3">
                    <div class="text-[11px] text-[#737373] mb-1">企业说明</div>
                    <textarea v-model="node.metadata.enterpriseNotes" rows="2" class="input-field"></textarea>
                  </label>
                </div>
                <div class="flex flex-col gap-2">
                  <button type="button" class="btn-secondary text-xs" @click="moveNode(Number(index), -1)">上移</button>
                  <button type="button" class="btn-secondary text-xs" @click="moveNode(Number(index), 1)">下移</button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex justify-end mt-6">
            <button class="btn-primary text-sm" :disabled="saving" @click="saveWorkflow">{{ saving ? '保存中...' : (editor.id && !editor.is_system ? '保存工作流' : '另存为新工作流') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
