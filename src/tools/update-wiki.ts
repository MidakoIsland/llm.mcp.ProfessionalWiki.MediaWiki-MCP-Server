import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { wikiService } from '../common/wikiService.js';
import { clearMwnCache } from '../common/mwn.js';

export function updateWikiTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'update-wiki',
		'Updates the configuration of an existing wiki resource. Useful for injecting or updating authentication credentials dynamically.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org). Must match an existing config key.' ),
			sitename: z.string().optional().describe( 'Display name for the wiki.' ),
			serverUrl: z.string().optional().describe( 'Base URL of the wiki (e.g., https://en.wikipedia.org).' ),
			articlepath: z.string().optional().describe( 'Path pattern for articles (e.g. /wiki).' ),
			scriptpath: z.string().optional().describe( 'Path to MediaWiki scripts (e.g. /w).' ),
			token: z.string().optional().describe( 'OAuth2 access token for authenticated operations.' ),
			username: z.string().optional().describe( 'Bot username (fallback when OAuth2 is not available).' ),
			password: z.string().optional().describe( 'Bot password (fallback when OAuth2 is not available).' ),
			private: z.boolean().optional().describe( 'Whether the wiki requires authentication to read.' )
		},
		{
			title: 'Update wiki',
			destructiveHint: true
		} as ToolAnnotations,
		( args ) => handleUpdateWikiTool( server, args )
	);
}

function handleUpdateWikiTool( server: McpServer, args: {
	wikiSite: string;
	sitename?: string;
	serverUrl?: string;
	articlepath?: string;
	scriptpath?: string;
	token?: string;
	username?: string;
	password?: string;
	private?: boolean;
} ): CallToolResult {
	try {
		const existingWiki = wikiService.get( args.wikiSite );
		if ( !existingWiki ) {
			return {
				content: [
					{
						type: 'text',
						text: `mcp://wikis/${ args.wikiSite } not found in MCP resources.`
					} as TextContent
				],
				isError: true
			};
		}

		// Filter out undefined arguments to prevent overwriting existing keys with undefined
		const updates: Record<string, string | boolean> = {};
		if ( args.sitename !== undefined ) {
			updates.sitename = args.sitename;
		}
		if ( args.serverUrl !== undefined ) {
			updates.server = args.serverUrl;
		}
		if ( args.articlepath !== undefined ) {
			updates.articlepath = args.articlepath;
		}
		if ( args.scriptpath !== undefined ) {
			updates.scriptpath = args.scriptpath;
		}
		if ( args.token !== undefined ) {
			updates.token = args.token;
		}
		if ( args.username !== undefined ) {
			updates.username = args.username;
		}
		if ( args.password !== undefined ) {
			updates.password = args.password;
		}
		if ( args.private !== undefined ) {
			updates.private = args.private;
		}

		wikiService.update( args.wikiSite, updates );

		clearMwnCache( args.wikiSite );

		server.sendResourceListChanged();

		return {
			content: [
				{
					type: 'text',
					text: `Wiki configuration for ${ args.wikiSite } has been successfully updated.`
				} as TextContent
			]
		};
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Failed to update wiki: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}
}
