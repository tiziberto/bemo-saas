<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AuthLayout from '../components/AuthLayout.vue';
import UiIcon from '../components/ui/UiIcon.vue';
import { errMessage } from '../lib/api';
import { useAuth } from '../stores/auth';
import { useUi } from '../stores/ui';

const auth = useAuth();
const ui = useUi();
const route = useRoute();
const router = useRouter();

const token = ref((route.query.token as string) || '');
const fullName = ref('');
const password = ref('');
const showPass = ref(false);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    await auth.acceptInvite({
      token: token.value.trim(),
      fullName: fullName.value.trim(),
      password: password.value,
    });
    ui.success('¡Listo!', 'Tu cuenta quedó activada.');
    router.push('/hoy');
  } catch (e) {
    error.value = errMessage(e, 'No pudimos activar la cuenta');
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <AuthLayout>
    <div class="card pad">
      <h1 style="font-size:20px">Sumate al equipo</h1>
      <p class="muted text-sm mb-lg" style="margin-top:4px">
        Creá tu contraseña para activar la cuenta que te invitaron.
      </p>

      <form @submit.prevent="submit">
        <div class="field">
          <label class="label" for="token">Código de invitación</label>
          <input
            id="token"
            v-model="token"
            required
            class="mono text-xs"
            placeholder="Pegá acá el código que te pasaron"
          />
          <p class="hint">Viene en el link de invitación. Se usa una sola vez y vence a los 7 días.</p>
        </div>
        <div class="field">
          <label class="label" for="name">Tu nombre</label>
          <input id="name" v-model="fullName" required placeholder="Dra. Ana Gómez" />
        </div>
        <div class="field">
          <label class="label" for="pass">Contraseña (mínimo 8)</label>
          <div style="position:relative">
            <input
              id="pass"
              v-model="password"
              :type="showPass ? 'text' : 'password'"
              required
              minlength="8"
              autocomplete="new-password"
              style="padding-right:40px"
            />
            <button
              type="button"
              class="icon-btn"
              style="position:absolute;right:3px;top:3px"
              :aria-label="showPass ? 'Ocultar contraseña' : 'Mostrar contraseña'"
              @click="showPass = !showPass"
            >
              <UiIcon :name="showPass ? 'eye-off' : 'eye'" size="16" />
            </button>
          </div>
        </div>

        <div v-if="error" class="alert err">
          <UiIcon name="alert-circle" size="16" />{{ error }}
        </div>

        <button class="btn block lg mt-md" :disabled="loading">
          <span v-if="loading" class="spinner"></span>
          {{ loading ? 'Activando…' : 'Activar mi cuenta' }}
        </button>
      </form>
    </div>

    <p class="muted text-sm" style="text-align:center;margin-top:16px">
      ¿Ya la activaste? <router-link to="/login">Ingresá</router-link>
    </p>
  </AuthLayout>
</template>
