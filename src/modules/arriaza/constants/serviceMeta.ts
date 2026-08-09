// Metadatos visuales por tipo de servicio · paridad con TT_SVC_META del HTML.
// Cada servicio tiene un color exclusivo + ícono + gradiente para PDFs.

export type ServiceKey =
  | 'tickets'
  | 'hotel'
  | 'restaurantes'
  | 'renta'
  | 'tours'
  | 'aeronave'
  | 'acuatico'
  | 'ferry'
  | 'terrestre'
  | 'actividades'
  | 'tiendas'
  | 'reunion'
  | 'ruta'
  | 'poi';

export type ServiceMeta = {
  label: string;
  icon: string;
  css: string;
  grad: string;
  solid: string;
  dark: string;
  light: string;
  hasCost: boolean;
  // Nombre de la tabla parent en Supabase
  table: string;
  // Nombre en el array del viaje (para itinerario / display)
  arrayKey: string;
};

export const SERVICE_META: Record<ServiceKey, ServiceMeta> = {
  tickets: {
    label: 'Ticket Aéreo', icon: '✈️', css: 'svc-tickets',
    grad: 'linear-gradient(135deg,#0d2b2e,#077e84,#00b4c5)',
    solid: '#077e84', dark: '#055a5f', light: '#d0eced',
    hasCost: true, table: 'att_tickets', arrayKey: 'tickets',
  },
  hotel: {
    label: 'Hotel', icon: '🏨', css: 'svc-hotel',
    grad: 'linear-gradient(135deg,#3d2f0a,#9e7a1a,#c9a227)',
    solid: '#9e7a1a', dark: '#7a5e14', light: '#f5f0d8',
    hasCost: true, table: 'att_hoteles', arrayKey: 'hotels',
  },
  restaurantes: {
    label: 'Restaurante', icon: '🍽️', css: 'svc-restaurantes',
    grad: 'linear-gradient(135deg,#3d1503,#bf4609,#e0733f)',
    solid: '#bf4609', dark: '#8f3406', light: '#f7e6de',
    hasCost: true, table: 'att_restaurantes', arrayKey: 'restaurantes',
  },
  renta: {
    label: 'Renta de Vehículo', icon: '🚗', css: 'svc-renta',
    grad: 'linear-gradient(135deg,#241030,#5a3472,#8a5aa8)',
    solid: '#5a3472', dark: '#432658', light: '#ece3f2',
    hasCost: true, table: 'att_rentas', arrayKey: 'rentas',
  },
  tours: {
    label: 'Tour', icon: '🗺️', css: 'svc-tours',
    grad: 'linear-gradient(135deg,#12280f,#2a6e24,#4f9c47)',
    solid: '#2a6e24', dark: '#1e5019', light: '#e1f0df',
    hasCost: true, table: 'att_tours', arrayKey: 'tours',
  },
  aeronave: {
    label: 'Renta de Aeronave', icon: '🛩️', css: 'svc-aeronave',
    grad: 'linear-gradient(135deg,#08252c,#0b5c6e,#1591ab)',
    solid: '#0b5c6e', dark: '#07424f', light: '#ddeef1',
    hasCost: true, table: 'att_aeronaves', arrayKey: 'aeronaves',
  },
  acuatico: {
    label: 'Traslado Acuático', icon: '🚤', css: 'svc-acuatico',
    grad: 'linear-gradient(135deg,#062e33,#0e7490,#22b8d4)',
    solid: '#0e7490', dark: '#0a5a6e', light: '#d9f2f6',
    hasCost: true, table: 'att_acuaticos', arrayKey: 'acuaticos',
  },
  ferry: {
    label: 'Servicio Ferry', icon: '⛴️', css: 'svc-ferry',
    grad: 'linear-gradient(135deg,#161d3c,#3b4d8a,#5e73bd)',
    solid: '#3b4d8a', dark: '#2b3966', light: '#e4e7f5',
    hasCost: true, table: 'att_ferries', arrayKey: 'ferries',
  },
  terrestre: {
    label: 'Traslado Terrestre', icon: '🚐', css: 'svc-terrestre',
    grad: 'linear-gradient(135deg,#1c2128,#445164,#6b7d94)',
    solid: '#445164', dark: '#2a323d', light: '#e6e9ee',
    hasCost: true, table: 'att_terrestres', arrayKey: 'terrestres',
  },
  actividades: {
    label: 'Actividad / Evento', icon: '🎭', css: 'svc-actividades',
    grad: 'linear-gradient(135deg,#3d1030,#a83279,#c85fa3)',
    solid: '#a83279', dark: '#6b1f52', light: '#f6e0ee',
    hasCost: true, table: 'att_actividades', arrayKey: 'actividades',
  },
  tiendas: {
    label: 'Tienda', icon: '🛍️', css: 'svc-tiendas',
    grad: 'linear-gradient(135deg,#2e2013,#8a5a2e,#b98a52)',
    solid: '#8a5a2e', dark: '#5c3b1e', light: '#f0e6d8',
    hasCost: false, table: 'att_tiendas', arrayKey: 'tiendas',
  },
  reunion: {
    label: 'Reunión', icon: '🤝', css: 'svc-reunion',
    grad: 'linear-gradient(135deg,#2c1a54,#7c3aed,#a685f5)',
    solid: '#7c3aed', dark: '#5b21b6', light: '#efe6fc',
    hasCost: false, table: 'att_reuniones', arrayKey: 'reuniones',
  },
  ruta: {
    label: 'Ruta Google Maps', icon: '📍', css: 'svc-ruta',
    grad: 'linear-gradient(135deg,#0d2c54,#1a73e8,#5b9df9)',
    solid: '#1a73e8', dark: '#12539c', light: '#e3edfc',
    hasCost: false, table: 'att_rutas', arrayKey: 'rutas',
  },
  poi: {
    label: 'Punto de Interés', icon: '⭐', css: 'svc-poi',
    grad: 'linear-gradient(135deg,#4a2e00,#e08e0b,#f0b74a)',
    solid: '#e08e0b', dark: '#9c6608', light: '#fdf0d8',
    hasCost: false, table: 'att_pois', arrayKey: 'pois',
  },
};

export const SERVICE_KEYS: readonly ServiceKey[] = [
  'tickets', 'hotel', 'restaurantes', 'renta', 'tours', 'aeronave',
  'acuatico', 'ferry', 'terrestre', 'actividades',
  'tiendas', 'reunion', 'ruta', 'poi',
];

// Colores del badge de estado_pago (paridad con ttEstadoBadgeColors del HTML).
export type EstadoPago =
  | 'Reservado'
  | 'Pagado'
  | 'Pago parcial'
  | 'A pagar en propiedad'
  | 'Cancelado';

export const ESTADO_PAGO_COLORS: Record<EstadoPago, { bg: string; fg: string }> = {
  'Reservado': { bg: '#e8ecef', fg: '#4a5568' },
  'Pagado': { bg: '#e1f0df', fg: '#1e5019' },
  'Pago parcial': { bg: '#f5f0d8', fg: '#7a5e14' },
  'A pagar en propiedad': { bg: '#ece3f2', fg: '#432658' },
  'Cancelado': { bg: '#f7e6de', fg: '#8f3406' },
};

// Workflow manual del viaje (paridad con ttManualStatusColor del HTML).
export type ManualStatus = 'Solicitado' | 'En planeación' | 'En curso' | 'Finalizado';

export const MANUAL_STATUS_COLORS: Record<ManualStatus, { bg: string; fg: string }> = {
  'Solicitado': { bg: '#e8ecef', fg: '#4a5568' },
  'En planeación': { bg: '#f5f0d8', fg: '#7a5e14' },
  'En curso': { bg: '#d0eced', fg: '#055a5f' },
  'Finalizado': { bg: '#e1f0df', fg: '#1e5019' },
};

export const MANUAL_STATUSES: readonly ManualStatus[] = [
  'Solicitado', 'En planeación', 'En curso', 'Finalizado',
];
