import * as fs from 'fs';
import * as path from 'path';

export interface LambdaConfig {
  name: string;
  runtime: string;
  handler: string;
  timeout: number;
  memorySize: number;
  codeSize: number;
  layers: string[];
  layerCount: number;
  environment: { [key: string]: string };
}

export class LambdaConfigLoader {
  private static configs: LambdaConfig[] | null = null;
  
  static loadAll(): LambdaConfig[] {
    if (this.configs) {
      return this.configs;
    }
    
    const configPath = path.join(__dirname, '../../config/lambda-packages.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    this.configs = JSON.parse(configData);
    return this.configs!;
  }
  
  static getByName(functionName: string): LambdaConfig | undefined {
    const configs = this.loadAll();
    return configs.find(c => c.name === functionName);
  }
  
  static getByPrefix(prefix: string): LambdaConfig[] {
    const configs = this.loadAll();
    return configs.filter(c => c.name.startsWith(prefix));
  }
  
  static getAllWithLayers(): LambdaConfig[] {
    const configs = this.loadAll();
    return configs.filter(c => c.layerCount > 0);
  }
  
  static getAllWithoutLayers(): LambdaConfig[] {
    const configs = this.loadAll();
    return configs.filter(c => c.layerCount === 0);
  }
  
  static getPackagePath(functionName: string): string {
    return path.join(__dirname, '../../dist/lambda-packages', `${functionName}.zip`);
  }
  
  static packageExists(functionName: string): boolean {
    return fs.existsSync(this.getPackagePath(functionName));
  }
}

