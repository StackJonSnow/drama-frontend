<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();
const toast = useToast();

const newName = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');
const savingProfile = ref(false);

const userInitials = computed(() => {
  const source = authStore.currentUser?.name || authStore.currentUser?.email || 'U';
  return source.slice(0, 2).toUpperCase();
});

watch(() => props.isOpen, (newVal) => {
  if (newVal && authStore.currentUser) {
    newName.value = authStore.currentUser.name || '';
    currentPassword.value = '';
    newPassword.value = '';
    confirmPassword.value = '';
  }
});

async function updateProfile() {
  if (newPassword.value && newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的密码不一致');
    return;
  }

  savingProfile.value = true;

  try {
    const payload: { name?: string; currentPassword?: string; newPassword?: string } = {};

    if (newName.value !== authStore.currentUser?.name) {
      payload.name = newName.value;
    }

    if (newPassword.value) {
      payload.currentPassword = currentPassword.value;
      payload.newPassword = newPassword.value;
    }

    if (!Object.keys(payload).length) {
      toast.info('没有需要保存的资料');
      return;
    }

    const response = await apiService.updateProfile(payload);

    if (!response.success) {
      throw new Error(response.message || '更新失败');
    }

    toast.success(response.message || '个人资料已更新');
    
    if (newPassword.value) {
      toast.info('密码已修改，请重新登录');
      setTimeout(() => {
        authStore.logout();
        window.location.href = '/login';
      }, 1500);
    } else {
      await authStore.fetchCurrentUser();
      newName.value = authStore.currentUser?.name || '';
      emit('close');
    }
  } catch (error: any) {
    toast.error(error.message || '更新失败');
  } finally {
    savingProfile.value = false;
  }
}

function logout() {
  authStore.logout();
  window.location.href = '/login';
}
</script>

<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
    <!-- Backdrop -->
    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" @click="emit('close')"></div>

    <!-- Modal Panel -->
    <div class="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-[#191919] border border-[#2F2F2F] shadow-2xl transition-all flex flex-col max-h-[90vh]">
      <!-- Header -->
      <div class="px-6 py-4 border-b border-[#2F2F2F] flex items-center justify-between shrink-0">
        <h3 class="text-lg font-semibold text-white">账号资料</h3>
        <button @click="emit('close')" class="text-[#737373] hover:text-white transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="p-6 overflow-y-auto">
        <div class="flex items-center gap-4 mb-6">
          <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white text-lg font-semibold shadow-lg shrink-0">
            {{ userInitials }}
          </div>
          <div class="min-w-0">
            <div class="text-sm text-[#737373] truncate">{{ authStore.currentUser?.email }}</div>
            <div class="text-xs text-[#A3A3A3] mt-1">更新昵称与登录密码</div>
          </div>
        </div>

        <div class="space-y-4">
          <div>
            <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">显示名称</label>
            <input v-model="newName" class="input-field bg-[#141414]" type="text" placeholder="输入显示名称" />
          </div>

          <div class="pt-4 border-t border-[#2F2F2F] space-y-3">
            <div class="text-sm font-medium text-white mb-2">修改密码</div>
            <input v-model="currentPassword" class="input-field bg-[#141414]" type="password" placeholder="当前密码" />
            <input v-model="newPassword" class="input-field bg-[#141414]" type="password" placeholder="新密码" />
            <input v-model="confirmPassword" class="input-field bg-[#141414]" type="password" placeholder="确认新密码" />
            <p v-if="newPassword" class="text-xs text-amber-400/80 mt-2">修改密码成功后将自动退出登录</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="px-6 py-4 border-t border-[#2F2F2F] bg-[#141414] flex items-center justify-between shrink-0">
        <button @click="logout" class="text-sm text-red-400 hover:text-red-300 transition-colors">
          退出登录
        </button>
        <div class="flex gap-3">
          <button @click="emit('close')" class="px-4 py-2 rounded-xl text-sm font-medium text-[#A3A3A3] hover:text-white transition-colors">
            取消
          </button>
          <button @click="updateProfile" :disabled="savingProfile" class="btn-primary py-2 px-5 flex items-center gap-2">
            <span v-if="savingProfile" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
            <span>{{ savingProfile ? '保存中...' : '保存更改' }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
