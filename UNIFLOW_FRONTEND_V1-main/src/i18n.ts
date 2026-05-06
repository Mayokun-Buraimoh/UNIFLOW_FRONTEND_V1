import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Our translations
// We can move these to separate JSON files later if they get too large.
const resources = {
  English: {
    translation: {
      "greeting_morning": "Good morning",
      "greeting_afternoon": "Good afternoon",
      "greeting_evening": "Good evening",
      "tasks": "Tasks",
      "events": "Events",
      "settings": "Settings",
      "my_profile": "My Profile",
      "app_preferences": "App Preferences",
      "log_out": "Log out",
      "default_language": "Default Language",
      "default_start_page": "Default Start Page",
      "week_start": "Week Start",
      "update": "Update",
      "updating": "Updating..."
    }
  },
  French: {
    translation: {
      "greeting_morning": "Bonjour",
      "greeting_afternoon": "Bon après-midi",
      "greeting_evening": "Bonsoir",
      "tasks": "Tâches",
      "events": "Événements",
      "settings": "Paramètres",
      "my_profile": "Mon Profil",
      "app_preferences": "Préférences de l'application",
      "log_out": "Déconnexion",
      "default_language": "Langue par défaut",
      "default_start_page": "Page de démarrage par défaut",
      "week_start": "Début de la semaine",
      "update": "Mettre à jour",
      "updating": "Mise à jour..."
    }
  },
  Dutch: {
    translation: {
      "greeting_morning": "Goedemorgen",
      "greeting_afternoon": "Goedemiddag",
      "greeting_evening": "Goedenavond",
      "tasks": "Taken",
      "events": "Evenementen",
      "settings": "Instellingen",
      "my_profile": "Mijn Profiel",
      "app_preferences": "App-voorkeuren",
      "log_out": "Uitloggen",
      "default_language": "Standaardtaal",
      "default_start_page": "Standaard Startpagina",
      "week_start": "Begin van de week",
      "update": "Bijwerken",
      "updating": "Bijwerken..."
    }
  },
  Spanish: {
    translation: {
      "greeting_morning": "Buenos días",
      "greeting_afternoon": "Buenas tardes",
      "greeting_evening": "Buenas noches",
      "tasks": "Tareas",
      "events": "Eventos",
      "settings": "Configuración",
      "my_profile": "Mi Perfil",
      "app_preferences": "Preferencias de la app",
      "log_out": "Cerrar sesión",
      "default_language": "Idioma predeterminado",
      "default_start_page": "Página de inicio predeterminada",
      "week_start": "Inicio de la semana",
      "update": "Actualizar",
      "updating": "Actualizando..."
    }
  },
  Portugese: {
    translation: {
      "greeting_morning": "Bom dia",
      "greeting_afternoon": "Boa tarde",
      "greeting_evening": "Boa noite",
      "tasks": "Tarefas",
      "events": "Eventos",
      "settings": "Configurações",
      "my_profile": "Meu Perfil",
      "app_preferences": "Preferências do Aplicativo",
      "log_out": "Sair",
      "default_language": "Idioma padrão",
      "default_start_page": "Página inicial padrão",
      "week_start": "Início da semana",
      "update": "Atualizar",
      "updating": "Atualizando..."
    }
  }
};

i18n
  .use(initReactI18next) // passes i18n down to react-i18next
  .init({
    resources,
    lng: localStorage.getItem('uniflow_language') || "English",
    fallbackLng: "English",
    interpolation: {
      escapeValue: false // react already safes from xss
    }
  });

export default i18n;
