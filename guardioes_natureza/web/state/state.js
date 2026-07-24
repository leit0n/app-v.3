export function createInitialState() {
  const init = {
    profile: {
      id: 'local',
      userId: 1, // guest account seeded in database/schema.sql
      name: 'Guardião(a)',
      createdAt: Date.now(),
      settings: {
        notificationsEnabled: true,
        reduceMotion: false,
      },
    },
    notifications: [
      {
        id: 'n1',
        title: 'Bem-vindo(a) ao Guardiões da Natureza',
        body: 'Complete seu primeiro reporte para ganhar troféus.',
        createdAt: Date.now() - 1000 * 60 * 60 * 6,
        read: false,
        route: '/challenges',
      },
      {
        id: 'n2',
        title: 'Ajuda rápida',
        body: 'No mapa, clique em um popup para iniciar o fluxo de reporte.',
        createdAt: Date.now() - 1000 * 60 * 60 * 2,
        read: false,
        route: '/map',
      },
    ],
    reports: [],
    myReports: [],
    mapFilters: {
      types: {
        desmatamento: true,
        lixo: true,
        incendio: true,
      },
      onlyNearby: false,
      lastHotspot: null,
    },
    challenges: [
      {
        id: 'first_report',
        title: 'Primeiro passo',
        description: 'Envie o seu primeiro reporte.',
        target: 1,
        value: 0,
        completed: false,
        trophy: '🥇',
      },
      {
        id: 'report_eco',
        title: 'Eco Ação',
        description: 'Envie 5 reportes no total.',
        target: 5,
        value: 0,
        completed: false,
        trophy: '🏆',
      },
      {
        id: 'photo_report',
        title: 'Registre!',
        description: 'Envie 3 reportes com “câmara” simulada.',
        target: 3,
        value: 0,
        completed: false,
        trophy: '📸',
      },
    ],
  };

  return init;
}

