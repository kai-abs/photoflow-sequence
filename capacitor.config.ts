
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.cb73d3ea6d754dc29c8e58dc27f6eb3d',
  appName: 'photoflow-sequence',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    url: 'https://cb73d3ea-6d75-4dc2-9c8e-58dc27f6eb3d.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    CapacitorHttp: {
      enabled: true
    }
  }
};

export default config;
