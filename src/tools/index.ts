/* eslint-disable n/no-missing-import */
import type { McpServer, RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
/* eslint-enable n/no-missing-import */

import { getPagesTool } from './get-pages.js';
import { getPageHistoriesTool } from './get-page-histories.js';
import { searchPagesTool } from './search-pages.js';
import { addWikiTool } from './add-wiki.js';
import { removeWikiTool } from './remove-wiki.js';
import { updatePagesTool } from './update-pages.js';
import { getFilesTool } from './get-files.js';
import { createPagesTool } from './create-pages.js';
import { uploadFilesTool } from './upload-files.js';
import { uploadFilesFromUrlTool } from './upload-files-from-url.js';
import { deletePagesTool } from './delete-pages.js';
import { getRevisionsTool } from './get-revisions.js';
import { undeletePagesTool } from './undelete-pages.js';
import { getCategoryMembersTool } from './get-category-members.js';
import { searchPagesByPrefixTool } from './search-pages-by-prefix.js';
import { searchPagesByVectorTool } from './search-pages-by-vector.js';
import { getNamespacesTool } from './get-namespaces.js';
import { createNamespaceTool } from './create-namespace.js';
import { updateWikiTool } from './update-wiki.js';
import { getCategoriesTool } from './get-categories.js';
import { movePagesTool } from './move-pages.js';
import { uploadFilesFromStreamTool } from './upload-files-from-stream.js';
import { updateVectorIndicesTool } from './update-vector-indices.js';

const toolRegistrars = [
	getPagesTool,
	getPageHistoriesTool,
	searchPagesTool,
	addWikiTool,
	removeWikiTool,
	updatePagesTool,
	getFilesTool,
	createPagesTool,
	uploadFilesTool,
	uploadFilesFromUrlTool,
	deletePagesTool,
	getRevisionsTool,
	undeletePagesTool,
	getCategoryMembersTool,
	searchPagesByPrefixTool,
	searchPagesByVectorTool,
	getNamespacesTool,
	createNamespaceTool,
	updateWikiTool,
	getCategoriesTool,
	movePagesTool,
	uploadFilesFromStreamTool,
	updateVectorIndicesTool
];

export function registerAllTools( server: McpServer ): RegisteredTool[] {
	const registeredTools: RegisteredTool[] = [];
	for ( const registrar of toolRegistrars ) {
		try {
			registeredTools.push( registrar( server ) );
		} catch ( error ) {
			console.error( `Error registering tool: ${ ( error as Error ).message }` );
		}
	}
	return registeredTools;
}
