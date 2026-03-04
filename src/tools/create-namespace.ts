import { z } from 'zod';
/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult, TextContent, ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
/* eslint-enable n/no-missing-import */
import { getMwn } from '../common/mwn.js';
import { ensureWiki } from '../common/utils.js';

export function createNamespaceTool( server: McpServer ): RegisteredTool {
	return server.tool(
		'create-namespace',
		'Creates a new custom namespace utilizing the BlueSpice Namespace Manager extension.',
		{
			wikiSite: z.string().describe( 'The name of the wiki site to interact with (e.g. usagi.games)' ),
			name: z.string().describe( 'Name of the new namespace' ),
			content: z.boolean().optional().default( true ).describe( 'Whether this is a content namespace (affects search priority)' ),
			subpages: z.boolean().optional().default( true ).describe( 'Enable subpages' ),
			visualeditor: z.boolean().optional().default( true ).describe( 'Enable VisualEditor' ),
			smw: z.boolean().optional().default( false ).describe( 'Enable Semantic MediaWiki for this namespace' ),
			pageassignmentsSecure: z.boolean().optional().default( false ).describe( 'Restrict editing to assigned users' ),
			readConfirmation: z.boolean().optional().default( false ).describe( 'Enable read confirmation' )
		},
		{
			title: 'Create namespace',
			readOnlyHint: false,
			destructiveHint: true
		} as ToolAnnotations,
		async ( args ) => handleCreateNamespaceTool( args )
	);
}

async function handleCreateNamespaceTool( args: {
	wikiSite: string;
	name: string;
	content: boolean;
	subpages: boolean;
	visualeditor: boolean;
	smw: boolean;
	pageassignmentsSecure: boolean;
	readConfirmation: boolean;
} ): Promise<CallToolResult> {
	ensureWiki( args.wikiSite );

	const taskData = {
		name: args.name,
		content: args.content,
		subpages: args.subpages,
		visualeditor: args.visualeditor,
		smw: args.smw,
		'pageassignments-secure': args.pageassignmentsSecure,
		// eslint-disable-next-line camelcase
		read_confirmation: args.readConfirmation
	};

	try {
		const mwn = await getMwn();
		const token = await mwn.getCsrfToken();

		const data = await mwn.request( {
			action: 'bs-namespace-tasks',
			task: 'add',
			taskData: JSON.stringify( taskData ),
			token: token
		}, { method: 'POST' } );

		return {
			content: [
				{
					type: 'text',
					text: `Namespace '${ args.name }' created successfully.\n\nResponse details: ${ JSON.stringify( data, null, 2 ) }`
				} as TextContent
			]
		};
	} catch ( error ) {
		return {
			content: [
				{
					type: 'text',
					text: `Failed to create namespace: ${ ( error as Error ).message }`
				} as TextContent
			],
			isError: true
		};
	}
}
