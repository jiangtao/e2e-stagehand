/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // 确保 Node.js 模块在客户端不被打包
    config.externals.push({
      'chrome-remote-interface': 'commonjs chrome-remote-interface',
      'ws': 'commonjs ws',
      'commander': 'commonjs commander'
    });
    return config;
  },
  // 启用实验性功能
  experimental: {
    serverComponentsExternalPackages: ['chrome-remote-interface', 'ws']
  }
};

module.exports = nextConfig;
