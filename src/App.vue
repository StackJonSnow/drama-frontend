<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRoute, RouterLink, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';
import { useToast } from '@/composables/useToast';
import apiService from '@/services/api';
import ToastContainer from './components/ToastContainer.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const toast = useToast();

const showSidebar = computed(() => route.meta.requiresAuth);

  const navItems = [
    { path: '/generate', label: '创作', icon: 'create' },
    { path: '/history', label: '历史记录', icon: 'history' },
    { path: '/studio/workflows', label: '工作流', icon: 'flow' },
    { path: '/studio/prompts', label: '提示词', icon: 'prompt' },
    { path: '/settings', label: '设置', icon: 'settings' },
  ];

const profileMenuOpen = ref(false);
const profileModalOpen = ref(false);
const passwordModalOpen = ref(false);
const savingProfile = ref(false);
const resettingPassword = ref(false);
const newName = ref('');
const currentPassword = ref('');
const newPassword = ref('');
const confirmPassword = ref('');

const userInitial = computed(() => (authStore.currentUser?.name || authStore.currentUser?.email || 'U')[0].toUpperCase());

function openProfileModal() {
  profileMenuOpen.value = false;
  newName.value = authStore.currentUser?.name || '';
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
  profileModalOpen.value = true;
}

function closeProfileModal() {
  profileModalOpen.value = false;
}

function openPasswordModal() {
  profileMenuOpen.value = false;
  passwordModalOpen.value = true;
  currentPassword.value = '';
  newPassword.value = '';
  confirmPassword.value = '';
}

function closePasswordModal() {
  passwordModalOpen.value = false;
}

async function logout() {
  profileMenuOpen.value = false;
  await authStore.logout();
  router.push('/login');
}

function toggleProfileMenu() {
  profileMenuOpen.value = !profileMenuOpen.value;
}

function closeProfileMenu() {
  profileMenuOpen.value = false;
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return;

  if (passwordModalOpen.value) {
    closePasswordModal();
    return;
  }

  if (profileModalOpen.value) {
    closeProfileModal();
    return;
  }

  if (profileMenuOpen.value) {
    closeProfileMenu();
  }
}

async function saveProfile() {
  savingProfile.value = true;

  try {
    if (newName.value === authStore.currentUser?.name) {
      toast.info('没有需要保存的资料');
      return;
    }

    const response = await apiService.updateProfile({ name: newName.value });

    if (!response.success) {
      throw new Error(response.message || '更新失败');
    }

    await authStore.fetchCurrentUser();
    toast.success(response.message || '个人资料已更新');
    profileModalOpen.value = false;
  } catch (error: any) {
    toast.error(error.message || '更新失败');
  } finally {
    savingProfile.value = false;
  }
}

async function resetPassword() {
  if (!currentPassword.value || !newPassword.value || !confirmPassword.value) {
    toast.error('请完整填写密码信息');
    return;
  }

  if (newPassword.value !== confirmPassword.value) {
    toast.error('两次输入的新密码不一致');
    return;
  }

  resettingPassword.value = true;

  try {
    const response = await apiService.updateProfile({
      currentPassword: currentPassword.value,
      newPassword: newPassword.value,
    });

    if (!response.success) {
      throw new Error(response.message || '重置密码失败');
    }

    toast.success('密码已重置，请重新登录');
    passwordModalOpen.value = false;
    profileModalOpen.value = false;
    await authStore.logout();
    router.push('/login');
  } catch (error: any) {
    toast.error(error.message || '重置密码失败');
  } finally {
    resettingPassword.value = false;
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleEscape);
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleEscape);
});
</script>

<template>
  <div class="flex h-screen overflow-hidden" style="background-color: #191919;">
    <aside v-if="showSidebar" class="sidebar w-[240px] flex-shrink-0 flex flex-col">
      <div class="px-4 h-12 flex items-center border-b border-[#2F2F2F]">
        <RouterLink to="/" class="flex items-center gap-2.5">
          <div class="w-6 h-6 rounded bg-[#2563EB] flex items-center justify-center">
            <svg class="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <span class="text-sm font-semibold text-[#EBEBEB]">AI剧本生成器</span>
        </RouterLink>
      </div>

      <nav class="flex-1 px-2 py-3 space-y-0.5">
        <RouterLink
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          :class="[
            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors duration-100',
            route.path === item.path || route.path.startsWith(item.path + '/')
              ? 'bg-[#2F2F2F] text-white'
              : 'text-[#A3A3A3] hover:bg-[#2F2F2F] hover:text-white'
          ]"
        >
          <svg v-if="item.icon === 'create'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          <svg v-else-if="item.icon === 'history'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <svg v-else-if="item.icon === 'flow'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h4a2 2 0 012 2v1h4m-8 7h4a2 2 0 002-2v-1h4M7 7a2 2 0 100-4 2 2 0 000 4zm0 14a2 2 0 100-4 2 2 0 000 4zm10-7a2 2 0 100-4 2 2 0 000 4z" />
          </svg>
          <svg v-else-if="item.icon === 'prompt'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 10h8M8 14h5m-7 6h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <svg v-else-if="item.icon === 'settings'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="relative px-3 py-3 border-t border-[#2F2F2F]">
        <button
          @click="toggleProfileMenu"
          class="w-full flex items-center gap-3 rounded-2xl border border-[#2F2F2F] bg-[#202020] px-3 py-3 text-left hover:border-[#3A3A3A] hover:bg-[#252525] transition-colors"
        >
          <div class="w-9 h-9 rounded-full bg-[#2563EB] flex items-center justify-center text-sm font-medium text-white flex-shrink-0">
            {{ userInitial }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-sm text-[#E5E5E5] truncate">{{ authStore.currentUser?.name || authStore.currentUser?.email }}</div>
            <div class="text-xs text-[#737373] truncate">账户菜单</div>
          </div>
          <svg class="w-4 h-4 text-[#737373] transition-transform" :class="profileMenuOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <div v-if="profileMenuOpen" class="fixed inset-0 z-30" @click="closeProfileMenu"></div>

        <div v-if="profileMenuOpen" class="absolute z-40 left-3 right-3 bottom-[84px] rounded-2xl border border-[#2F2F2F] bg-[#171717] shadow-2xl overflow-hidden">
          <button @click="openProfileModal" class="w-full px-4 py-3 text-left text-sm text-[#E5E5E5] hover:bg-[#222] transition-colors">
            账户资料
          </button>
          <button @click="openPasswordModal" class="w-full px-4 py-3 text-left text-sm text-[#E5E5E5] hover:bg-[#222] transition-colors border-t border-[#2A2A2A]">
            重置密码
          </button>
          <button @click="logout" class="w-full px-4 py-3 text-left text-sm text-red-300 hover:bg-[#2A1A1A] transition-colors border-t border-[#2A2A2A]">
            退出登录
          </button>
        </div>
      </div>
    </aside>

    <main class="flex-1 overflow-auto">
      <RouterView />
    </main>

    <Teleport to="body">
      <div v-if="profileModalOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="closeProfileModal"></div>
        <div class="relative w-full max-w-lg rounded-3xl border border-[#2F2F2F] bg-[#171717] shadow-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-[#2F2F2F] flex items-start justify-between gap-4">
            <div>
              <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-2">账户中心</div>
              <h3 class="text-2xl font-semibold text-white">用户资料</h3>
              <p class="text-sm text-[#8E8E8E] mt-2">资料与安全操作统一收纳在这里，设置页不再展示账号信息。</p>
            </div>
            <button @click="closeProfileModal" class="w-9 h-9 rounded-full border border-[#2F2F2F] text-[#A3A3A3] hover:text-white hover:border-[#404040] transition-colors">×</button>
          </div>

          <div class="p-6 space-y-5">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] flex items-center justify-center text-white text-lg font-semibold shadow-lg">
                {{ userInitial }}
              </div>
              <div>
                <div class="text-lg font-medium text-white">{{ authStore.currentUser?.name || '未设置名称' }}</div>
                <div class="text-sm text-[#737373]">{{ authStore.currentUser?.email }}</div>
              </div>
            </div>

            <div>
              <label class="block text-xs text-[#A3A3A3] mb-2 uppercase tracking-[0.18em]">显示名称</label>
              <input v-model="newName" type="text" class="input-field bg-[#191919]" placeholder="输入显示名称" />
            </div>

            <div class="rounded-2xl border border-[#2F2F2F] bg-black/20 p-4 flex items-center justify-between gap-4">
              <div>
                <div class="text-sm font-medium text-white">密码安全</div>
                <p class="text-xs text-[#8D8D8D] mt-1">重置密码后会立即退出当前登录，并跳转到登录页重新认证。</p>
              </div>
              <button @click="openPasswordModal" class="btn-secondary whitespace-nowrap">重置密码</button>
            </div>
          </div>

          <div class="px-6 py-5 border-t border-[#2F2F2F] flex justify-end gap-3 bg-[#151515]">
            <button @click="closeProfileModal" class="btn-ghost">关闭</button>
            <button @click="saveProfile" :disabled="savingProfile" class="btn-primary flex items-center gap-2">
              <span v-if="savingProfile" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
              <span>{{ savingProfile ? '保存中...' : '保存资料' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <Teleport to="body">
      <div v-if="passwordModalOpen" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/75 backdrop-blur-sm" @click="closePasswordModal"></div>
        <div class="relative w-full max-w-md rounded-3xl border border-[#2F2F2F] bg-[#171717] shadow-2xl overflow-hidden">
          <div class="px-6 py-5 border-b border-[#2F2F2F]">
            <div class="text-[11px] uppercase tracking-[0.18em] text-[#737373] mb-2">安全验证</div>
            <h3 class="text-2xl font-semibold text-white">重置密码</h3>
            <p class="text-sm text-[#8E8E8E] mt-2">重置成功后会立即退出登录，请使用新密码重新进入系统。</p>
          </div>

          <div class="p-6 space-y-4">
            <input v-model="currentPassword" type="password" class="input-field bg-[#191919]" placeholder="当前密码" />
            <input v-model="newPassword" type="password" class="input-field bg-[#191919]" placeholder="新密码" />
            <input v-model="confirmPassword" type="password" class="input-field bg-[#191919]" placeholder="确认新密码" />
          </div>

          <div class="px-6 py-5 border-t border-[#2F2F2F] flex justify-end gap-3 bg-[#151515]">
            <button @click="closePasswordModal" class="btn-ghost">取消</button>
            <button @click="resetPassword" :disabled="resettingPassword" class="btn-primary flex items-center gap-2">
              <span v-if="resettingPassword" class="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
              <span>{{ resettingPassword ? '提交中...' : '确认重置并退出登录' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <ToastContainer />
  </div>
</template>
