import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { discoverWiki } from '../common/wikiDiscovery.js';

export function addWikiTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'add-wiki',
		'Adds a new wiki to the MCP resources from a URL. You can also specify manual overrides or credentials if auto-discovery fails or authentication is needed.',
		{
			wikiUrl: z.string().url().describe( 'Any URL from the target wiki (e.g. https://usagi.games/wiki/Main_Page)' ),
			sitename: z.string().optional().describe( 'Display name for the wiki. Will try to auto-discover if not provided.' ),
			articlepath: z.string().optional().describe( 'Path pattern for articles (e.g. /wiki). Will try to auto-discover if not provided.' ),
			scriptpath: z.string().optional().describe( 'Path to MediaWiki scripts (e.g. /w). Will try to auto-discover if not provided.' ),
			token: z.string().optional().describe( 'OAuth2 access token for authenticated operations.' ),
			username: z.string().optional().describe( 'Bot username (fallback when OAuth2 is not available).' ),
			password: z.string().optional().describe( 'Bot password (fallback when OAuth2 is not available).' ),
			private: z.boolean().optional().describe( 'Whether the wiki requires authentication to read (defaults to false).' )
		},
		{
			title: 'Add wiki',
			destructiveHint: true
		} as ToolAnnotations,
		( args ) => handleAddWikiTool( server, args )
	);
}

async function handleAddWikiTool( server: McpServer, args: {
	wikiUrl: string;
	sitename?: string;
	articlepath?: string;
	scriptpath?: string;
	token?: string;
	username?: string;
	password?: string;
	private?: boolean;
} ): Promise<CallToolResult> {
	// Attempt to auto-discover wiki settings
	const wikiInfo = await discoverWiki( args.wikiUrl );

	let parsedUrl: URL;
	try {
		parsedUrl = new URL( args.wikiUrl );
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Invalid URL: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}

	const fallbackHostname = parsedUrl.hostname;
	const fallbackServer = `${ parsedUrl.protocol }//${ parsedUrl.host }`;

	const sitename = args.sitename ?? wikiInfo?.sitename ?? fallbackHostname;
	const serverUrl = wikiInfo?.server ?? fallbackServer;
	const articlepath = args.articlepath ?? wikiInfo?.articlepath ?? '/wiki';
	const scriptpath = args.scriptpath ?? wikiInfo?.scriptpath ?? '/w';
	const token = args.token ?? null;
	const username = args.username ?? null;
	const password = args.password ?? null;
	const isPrivate = args.private ?? false;
	const key = wikiInfo?.servername ?? fallbackHostname;

	try {
		const newConfig = {
			sitename: sitename,
			server: serverUrl,
			articlepath: articlepath,
			scriptpath: scriptpath,
			token: token,
			username: username,
			password: password,
			private: isPrivate
		};

		wikiService.add( key, newConfig );
		server.sendResourceListChanged();

		const message = wikiInfo ?
			`${ sitename } (mcp://wikis/${ key }) has been auto-discovered and added to MCP resources.` :
			`${ sitename } (mcp://wikis/${ key }) has been added to MCP resources using provided/fallback settings since auto-discovery was not possible or blocked.`;

		return {
			content: [
				{
					type: 'text',
					text: message
				} as TextContent
			]
		};
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Failed to add wiki: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}
}
