import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const port = parseInt(env.PORT); // MUST BE LOWERCASE

	return {
		plugins: [react(), tailwindcss(), tsconfigPaths()],
		base: './',
		build: {
			outDir: 'dist-react',
		},
		server: {
			port, // MUST BE LOWERCASE
			strictPort: true,
			headers: {
				'Content-Security-Policy': "default-src 'self'; connect-src 'self' http://* http://*:* https://* https://*:* ws://* wss://* http://10.10.20.19:* https://10.10.20.19:*; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; worker-src 'self' blob:;",
			},
			proxy: {
				// Proxy all Letta API calls through Vite dev server to avoid CORS
				'/v1': {
					target: env.VITE_API_URL || 'http://localhost:8283',
					changeOrigin: true,
					secure: false,
					followRedirects: true,
					timeout: 60000,
				},
				'/health': {
					target: env.VITE_API_URL || 'http://localhost:8283',
					changeOrigin: true,
					secure: false,
					followRedirects: true,
				},
			},
		},
	};
});
