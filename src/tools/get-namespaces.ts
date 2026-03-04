import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { ensureWiki } from '../common/utils.js';

export function getNamespacesTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'get-namespaces',
		'Gets a list of all namespaces in the wiki using BlueSpice Namespace Manager extension. Returns detailed namespace configuration.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. usagi.games)' )
		},
		{
			title: 'Get namespaces',
			readOnlyHint: true,
			destructiveHint: false
		} as ToolAnnotations,
		async ( { wikiSite } ) => handleGetNamespacesTool( wikiSite )
	);
}

async function handleGetNamespacesTool( wikiSite: string ): Promise< CallToolResult > {
	ensureWiki( wikiSite );

	try {
		const mwn = await getMwn();
		const data = await mwn.request( {
			action: 'bs-namespace-store'
		} );

		if ( !data.results || data.results.length === 0 ) {
			return {
				content: [
					{ type: 'text', text: 'No namespaces found.' } as TextContent
				]
			};
		}

		return {
			content: data.results.map( getNamespaceToolResult )
		};
	} catch ( error ) {
		return {
			content: [
				{ type: 'text', text: `Failed to retrieve namespaces: ${ ( error as Error ).message }` } as TextContent
			],
			isError: true
		};
	}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getNamespaceToolResult( result: any ): TextContent {
	return {
		type: 'text',
		text: [
			`ID: ${ result.id }`,
			`Name: ${ result.name }`,
			`Is System NS: ${ result.isSystemNS }`,
			`Is Talk NS: ${ result.isTalkNS }`,
			`Subpages Enabled: ${ result.subpages }`,
			`Content Namespace: ${ result.content?.value || result.content_raw }`,
			`VisualEditor: ${ result.visualeditor?.value }`,
			`SMW: ${ result.smw }`
		].join( '\n' )
	};
}
