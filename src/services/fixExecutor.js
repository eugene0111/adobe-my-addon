/**
 * Core fix execution logic
 * Works with mock or real fix actions
 */

/**
 * Expected fixAction format (finalized by Person B):
 * { action: string, element_id: string, value: any, range?: {...}, ... }
 */
export function createFixExecutor(editor, fonts, colorUtils, findNodeById) {
  
    async function applyFix(fixAction) {
      const { action, element_id, value } = fixAction;
      const node = findNodeById(element_id);
      
      if (!node) {
        throw new Error(`Node ${element_id} not found`);
      }
      
      return editor.queueAsyncEdit(async () => {
        switch (action) {
          case "update_font_size":
            const range = fixAction.range || { 
              start: 0, 
              length: node.fullContent?.text?.length || 0 
            };
            node.fullContent?.applyCharacterStyles?.(
              { fontSize: value },
              range
            );
            break;
            
          case "update_font_family":
            const fontObj = await fonts.fromPostscriptName(value);
            if (!fontObj) throw new Error(`Font ${value} unavailable`);
            node.fullContent?.applyCharacterStyles?.(
              { font: fontObj },
              fixAction.range || { start: 0, length: node.fullContent.text.length }
            );
            break;
            
          case "update_color":
          case "update_text_color":
            const color = colorUtils.fromHex(value);
            node.fullContent?.applyCharacterStyles?.(
              { color },
              fixAction.range || { start: 0, length: node.fullContent.text.length }
            );
            break;
            
          case "update_shape_fill":
            node.fill = editor.makeColorFill(colorUtils.fromHex(value));
            break;
            
          case "update_shape_stroke":
            node.stroke = editor.makeStroke({
              color: colorUtils.fromHex(value),
              width: fixAction.width || 1
            });
            break;
            
          default:
            throw new Error(`Unknown action: ${action}`);
        }
      });
    }
    
    async function applyBulkFixes(fixActions) {
      const results = [];
      for (const fixAction of fixActions) {
        try {
          await applyFix(fixAction);
          results.push({ success: true, action: fixAction });
        } catch (error) {
          results.push({ success: false, action: fixAction, error: error.message });
        }
      }
      return results;
    }
    
    return { applyFix, applyBulkFixes };
  }