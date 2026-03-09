import {
	WikiConfig,
	PublicWikiConfig,
	loadConfigFromFile,
	saveConfigToFile,
	VectorServerConfig,
	Config
} from './config.js';

type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

const config = loadConfigFromFile();

function sanitize( wikiConfig: DeepReadonly<WikiConfig> ): PublicWikiConfig {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	const { token: _token, username: _username, password: _password, ...publicConfig } = wikiConfig;
	return publicConfig;
}

function getAll(): DeepReadonly<Record<string, WikiConfig>> {
	return config.wikis as DeepReadonly<Record<string, WikiConfig>>;
}

function get( key: string ): DeepReadonly<WikiConfig> | undefined {
	return config.wikis[ key ] as DeepReadonly<WikiConfig> | undefined;
}

function add( key: string, wikiConfig: WikiConfig ): void {
	if ( !key || key.trim() === '' ) {
		throw new Error( 'Wiki key cannot be empty' );
	}

	if ( config.wikis[ key ] ) {
		throw new Error( `Wiki "${ key }" already exists in configuration` );
	}

	config.wikis[ key ] = wikiConfig;
	saveConfigToFile( config );
}

function update( key: string, wikiConfig: Partial<WikiConfig> ): void {
	if ( !key || key.trim() === '' ) {
		throw new Error( 'Wiki key cannot be empty' );
	}

	const existingConfig = config.wikis[ key ];
	if ( !existingConfig ) {
		throw new Error( `Wiki "${ key }" not found in configuration` );
	}

	config.wikis[ key ] = { ...existingConfig, ...wikiConfig };
	saveConfigToFile( config );
}

function remove( key: string ): void {
	delete config.wikis[ key ];
	saveConfigToFile( config );
}

function getFullConfig(): Config {
	return config as Config;
}

function getVectorServerConfig( wikiKey: string ): VectorServerConfig {
	const wikiConfig = config.wikis[ wikiKey ];
	if ( !wikiConfig ) {
		throw new Error( `Wiki "${ wikiKey }" not found in configuration` );
	}

	const fallbackConfig = config.defaultVectorServerConfig;
	const specificConfig = wikiConfig.vectorServerConfig;

	if ( specificConfig && specificConfig.serverUrl && specificConfig.apiKey !== undefined ) {
		return {
			serverUrl: specificConfig.serverUrl,
			apiKey: specificConfig.apiKey
		};
	}

	if ( specificConfig && specificConfig.serverUrl && specificConfig.apiKey === undefined ) {
		// If specific wiki overrides the URL but not the key, and the URL matches the fallback URL,
		// we can safely use the fallback key. Otherwise, we can't assume the fallback key is valid
		// for a completely different server URL.
		if ( fallbackConfig && fallbackConfig.serverUrl === specificConfig.serverUrl ) {
			return {
				serverUrl: specificConfig.serverUrl,
				apiKey: fallbackConfig.apiKey || ''
			};
		}
		// If it's a different server, default to empty API key
		return {
			serverUrl: specificConfig.serverUrl,
			apiKey: ''
		};
	}

	if ( specificConfig && !specificConfig.serverUrl && specificConfig.apiKey !== undefined ) {
		if ( fallbackConfig && fallbackConfig.serverUrl ) {
			return {
				serverUrl: fallbackConfig.serverUrl,
				apiKey: specificConfig.apiKey
			};
		}
		throw new Error( `Wiki "${ wikiKey }" configures an apiKey but no vector serverUrl is configured locally or globally.` );
	}

	if ( fallbackConfig && fallbackConfig.serverUrl ) {
		return {
			serverUrl: fallbackConfig.serverUrl,
			apiKey: fallbackConfig.apiKey || ''
		};
	}

	throw new Error( `No vectorServerConfig configured for wiki "${ wikiKey }" and no defaultVectorServerConfig found in global config.` );
}

export const wikiService = {
	getAll,
	get,
	add,
	update,
	remove,
	sanitize,
	getVectorServerConfig,
	getFullConfig
};

