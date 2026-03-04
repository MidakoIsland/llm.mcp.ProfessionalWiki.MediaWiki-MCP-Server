import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
import type { ApiDeleteResponse } from 'mwn';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { formatEditComment, ensureWiki } from '../common/utils.js';

export function deletePageTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'delete-page',
		'Deletes a wiki page.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. en.wikipedia.org)' ),
			title: z.string().describe( 'Wiki page title' ),
			comment: z.string().optional().describe( 'Reason for deleting the page' )
		},
		{
			title: 'Delete page',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async (
			{ wikiSite, title, comment }
		) => handleDeletePageTool( wikiSite, title, comment )
	);
}

async function handleDeletePageTool(
	wikiSite: string,
	title: string,
	comment?: string
): Promise<CallToolResult> {
	ensureWiki( wikiSite );

	let data: ApiDeleteResponse;
	try {
		const mwn = await getMwn();
		data = await mwn.delete( title, formatEditComment( 'delete-page', comment ) );
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Delete failed: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}

	return {
		content: deletePageToolResult( data )
	};
}

function deletePageToolResult( data: ApiDeleteResponse ): TextContent[] {
	return [
		{
			type: 'text',
			text: `Page deleted successfully: ${ data.title }`
		}
	];
}
