/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // 确保 Node.js 模块在客户端不被打包
    config.externals.push({
      'chrome-remote-interface': 'commonjs chrome-remote-interface',
      'ws': 'commonjs ws',
      'commander': 'commonjs commander',
      'dotenv': 'commonjs dotenv'
    });
    
    // 如果是服务器端，确保 dotenv 可以被解析
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false
      };
    }
    
    return config;
  },
  // 启用实验性功能
  experimental: {
    serverComponentsExternalPackages: ['chrome-remote-interface', 'ws', 'dotenv', '@browserbasehq/stagehand']
  }
};

module.exports = nextConfig;
