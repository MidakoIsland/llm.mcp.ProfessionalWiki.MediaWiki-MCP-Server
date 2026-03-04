import {
	WikiConfig,
	PublicWikiConfig,
	loadConfigFromFile,
	saveConfigToFile
} from './config.js';

type DeepReadonly<T> = {
	readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

const config = loadConfigFromFile();

let currentWikiKey: string | undefined;

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

function getCurrent(): { key: string; config: DeepReadonly<WikiConfig> } {
	if ( !currentWikiKey ) {
		throw new Error( 'No active wiki set. You must provide a valid wikiSite.' );
	}
	return {
		key: currentWikiKey,
		config: config.wikis[ currentWikiKey ] as DeepReadonly<WikiConfig>
	};
}

function setCurrent( key: string ): void {
	if ( !config.wikis[ key ] ) {
		throw new Error( `Wiki "${ key }" not found in config.json` );
	}
	currentWikiKey = key;
}

function reset(): void {
	currentWikiKey = undefined;
}
export const wikiService = {
	getAll,
	get,
	add,
	update,
	remove,
	getCurrent,
	setCurrent,
	sanitize,
	reset
};
