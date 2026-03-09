import { USER_AGENT } from '../server.js';
import { wikiService } from './wikiService.js';
import { Mwn, MwnOptions } from 'mwn';

// Shio: Cache Mwn instances by wikiSite key so we don't Thrash instances when
// the agent accesses multiple wikis in a single batch operation.
const mwnInstances = new Map<string, Mwn>();

export async function getMwn( wikiSite: string ): Promise<Mwn> {
	if ( mwnInstances.has( wikiSite ) ) {
		return mwnInstances.get( wikiSite )!;
	}

	const wikiConfig = wikiService.get( wikiSite );
	if ( !wikiConfig ) {
		throw new Error( `Wiki "${ wikiSite }" not found in configuration` );
	}

	const {
		server,
		scriptpath,
		token,
		username,
		password
	} = wikiConfig;

	const options: MwnOptions = {
		apiUrl: `${ server }${ scriptpath }/api.php`,
		userAgent: USER_AGENT
	};

	let mwnInstance: Mwn;

	if ( token ) {
		options.OAuth2AccessToken = token;
		mwnInstance = await Mwn.init( options );
	} else if ( username && password ) {
		options.username = username;
		options.password = password;
		mwnInstance = await Mwn.init( options );
	} else {
		mwnInstance = new Mwn( options );
		await mwnInstance.getSiteInfo();
	}

	mwnInstances.set( wikiSite, mwnInstance );
	return mwnInstance;
}

export function clearMwnCache( wikiSite?: string ): void {
	if ( wikiSite ) {
		mwnInstances.delete( wikiSite );
	} else {
		mwnInstances.clear();
	}
}
