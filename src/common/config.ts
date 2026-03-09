import * as fs from 'fs';

export interface VectorServerConfig {
	serverUrl: string;
	apiKey?: string;
}

export interface WikiConfig {
	/**
	 * Corresponds to the $wgSitename setting in MediaWiki.
	 */
	sitename: string;
	/**
	 * Corresponds to the $wgServer setting in MediaWiki.
	 */
	server: string;
	/**
	 * Corresponds to the $wgArticlePath setting in MediaWiki.
	 */
	articlepath: string;
	/**
	 * Corresponds to the $wgScriptPath setting in MediaWiki.
	 */
	scriptpath: string;
	/**
	 * OAuth consumer token requested from Extension:OAuth.
	 */
	token?: string | null;
	/**
	 * Username requested from Special:BotPasswords.
	 */
	username?: string | null;
	/**
	 * Password requested from Special:BotPasswords.
	 */
	password?: string | null;
	/**
	 * If the wiki always requires auth to access.
	 * $wgGroupPermissions['*']['read'] = false; in MediaWiki
	 */
	private?: boolean;
	/**
	 * Configuration for the associated LlamaIndex Vector engine endpoint for this wiki.
	 */
	vectorServerConfig?: Partial<VectorServerConfig>;
}

export type PublicWikiConfig = Omit<WikiConfig, 'token' | 'username' | 'password'>;

export interface Config {
	wikis: { [key: string]: WikiConfig };
	defaultVectorServerConfig?: VectorServerConfig;
	allowConcurrentBatchOperations?: boolean;
}

export const defaultConfig: Config = {
	wikis: {},
	defaultVectorServerConfig: {
		serverUrl: 'http://127.0.0.1:5000/search',
		apiKey: ''
	},
	allowConcurrentBatchOperations: false
};
const configPath = process.env.CONFIG || 'config.json';

export function loadConfigFromFile(): Config {
	if ( !fs.existsSync( configPath ) ) {
		return { ...defaultConfig };
	}
	const rawData = fs.readFileSync( configPath, 'utf-8' );
	const parsedData = JSON.parse( rawData ) as Partial<Config>;
	return { ...defaultConfig, ...parsedData };
}

export function saveConfigToFile( config: Config ): void {
	fs.writeFileSync( configPath, JSON.stringify( config, null, 2 ) + '\n', 'utf-8' );
}

