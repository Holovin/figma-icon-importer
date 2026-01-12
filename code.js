// Capitalize first letter utility
function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

// Sorting priorities
const THEME_PRIORITY = ['light', 'dark', 'dark1', 'dark2'];
const STATE_PRIORITY = ['default', 'blue', 'darkblue', 'grey', 'lightgrey', 'white', 'black', 'green', 'red', 'purple', 'on'];

function sortByPriority(items, priorityList) {
  return [...items].sort((a, b) => {
    const aIndex = priorityList.indexOf(a);
    const bIndex = priorityList.indexOf(b);
    
    // Both in priority list
    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }
    // Only a in list
    if (aIndex !== -1) return -1;
    // Only b in list
    if (bIndex !== -1) return 1;
    // Neither in list - sort alphabetically
    return a.localeCompare(b);
  });
}

// Send log message to UI
function log(message, level = '') {
  figma.ui.postMessage({ type: 'log', message, level });
}

// Cache of existing components on page
let existingComponentNames = new Set();

function scanExistingComponents() {
  existingComponentNames.clear();
  
  // Find all ComponentSets on current page
  const componentSets = figma.currentPage.findAllWithCriteria({
    types: ['COMPONENT_SET']
  });
  
  for (const cs of componentSets) {
    existingComponentNames.add(cs.name);
  }
  
  // Also find standalone components (for single-variant icons)
  const components = figma.currentPage.findAllWithCriteria({
    types: ['COMPONENT']
  });
  
  for (const c of components) {
    // Only top-level components (not inside ComponentSet)
    if (c.parent === figma.currentPage || (c.parent && c.parent.type !== 'COMPONENT_SET')) {
      existingComponentNames.add(c.name);
    }
  }
  
  return existingComponentNames.size;
}

function isComponentExists(name) {
  return existingComponentNames.has(name);
}

// Show UI
figma.showUI(__html__, { width: 400, height: 520 });

// Scan existing components on startup
const existingCount = scanExistingComponents();
log(`Found ${existingCount} existing components on page`, 'info');

// Handle messages from UI
figma.ui.onmessage = async (msg) => {
  if (msg.type === 'create-icon') {
    await createIconComponent(msg);
  }
};

async function createIconComponent({ category, name, themes, states, variants, position, hasProblems, iconWidth, iconHeight }) {
  // Build component name with size suffix
  let sizeSuffix = '';
  if (iconWidth === iconHeight) {
    sizeSuffix = `${iconWidth}`;
  } else {
    sizeSuffix = `${iconWidth}x${iconHeight}`;
  }
  
  const componentName = `Icon / ${capitalize(category)} / ${capitalize(name)}${sizeSuffix}`;
  
  // Check if component already exists
  if (isComponentExists(componentName)) {
    log(`⏭️ Skipped (already exists): ${componentName}`, 'warn');
    figma.ui.postMessage({ 
      type: 'component-created', 
      width: 0, 
      height: 0,
      skipped: true
    });
    return;
  }
  
  log(`Creating: ${componentName}`, 'info');
  
  const gap = 20;
  const createdVariants = [];
  
  // Sort themes and states by priority
  const sortedThemes = sortByPriority(themes, THEME_PRIORITY);
  const sortedStates = sortByPriority(states, STATE_PRIORITY);
  
  log(`  Themes (sorted): ${sortedThemes.join(', ')}`, 'info');
  log(`  States (sorted): ${sortedStates.join(', ')}`, 'info');
  
  // Track creation problems
  let creationProblems = false;
  
  // Create variants in correct order: themes on X axis, states on Y axis
  for (let themeIndex = 0; themeIndex < sortedThemes.length; themeIndex++) {
    const theme = sortedThemes[themeIndex];
    
    for (let stateIndex = 0; stateIndex < sortedStates.length; stateIndex++) {
      const state = sortedStates[stateIndex];
      
      // Find variant data
      const variant = variants.find(v => v.theme === theme && v.state === state);
      
      if (!variant) {
        log(`Variant not found: ${theme}/${state}`, 'error');
        creationProblems = true;
        continue;
      }
      
      try {
        // Create component (variant)
        const component = figma.createComponent();
        // Variant names in lowercase
        component.name = `theme=${theme}, state=${state}`;
        component.resize(iconWidth, iconHeight);
        
        if (variant.isMissing) {
          creationProblems = true;
          // Create placeholder with color #F700FF
          const rect = figma.createRectangle();
          rect.resize(iconWidth, iconHeight);
          rect.x = 0;
          rect.y = 0;
          rect.fills = [{ type: 'SOLID', color: { r: 0xF7 / 255, g: 0x00 / 255, b: 0xFF / 255 } }];
          rect.name = 'missing-placeholder';
          component.appendChild(rect);
        } else {
          // Create image from bytes
          const imageBytes = new Uint8Array(variant.bytes);
          const image = figma.createImage(imageBytes);
          
          // Create rectangle with image fill
          const rect = figma.createRectangle();
          rect.resize(iconWidth, iconHeight);
          rect.x = 0;
          rect.y = 0;
          rect.fills = [{
            type: 'IMAGE',
            imageHash: image.hash,
            scaleMode: 'FILL'
          }];
          rect.name = 'icon';
          component.appendChild(rect);
        }
        
        createdVariants.push({
          component,
          theme,
          state,
          themeIndex,
          stateIndex
        });
        
      } catch (err) {
        creationProblems = true;
        log(`Error creating variant ${theme}/${state}: ${err.message} (${err.name})`, 'error');
      }
    }
  }
  
  // Final problems flag
  const hasAnyProblems = hasProblems || creationProblems;
  
  if (createdVariants.length === 0) {
    log(`No variants for ${componentName}`, 'error');
    figma.ui.postMessage({ type: 'component-created', width: 0, height: 0 });
    return;
  }
  
  let finalWidth = 0;
  let finalHeight = 0;
  
  // If only one variant - just rename the component
  if (createdVariants.length === 1) {
    const comp = createdVariants[0].component;
    comp.name = componentName;
    comp.x = position.x;
    comp.y = position.y;
    finalWidth = iconWidth;
    finalHeight = iconHeight;
    
    // Add to existing cache
    existingComponentNames.add(componentName);
    
    log(`Created component (1 variant): ${componentName}`, 'success');
  } else {
    // Combine into Component Set
    try {
      const components = createdVariants.map(v => v.component);
      const componentSet = figma.combineAsVariants(components, figma.currentPage);
      componentSet.name = componentName;
      
      // Configure Grid Layout
      componentSet.layoutMode = 'GRID';
      componentSet.gridRowCount = sortedStates.length;
      componentSet.gridColumnCount = sortedThemes.length;
      componentSet.gridRowGap = gap;
      componentSet.gridColumnGap = gap;
      componentSet.paddingLeft = gap;
      componentSet.paddingRight = gap;
      componentSet.paddingTop = gap;
      componentSet.paddingBottom = gap;
      
      // Hug for width and height
      componentSet.layoutSizingHorizontal = 'HUG';
      componentSet.layoutSizingVertical = 'HUG';
      
      // Position variants in grid: themes on X (columns), states on Y (rows)
      for (const child of componentSet.children) {
        // Parse variant name to get theme and state
        const nameMatch = child.name.match(/theme=(\w+), state=(\w+)/);
        if (!nameMatch) continue;
        
        const [, childTheme, childState] = nameMatch;
        const themeIndex = sortedThemes.indexOf(childTheme);
        const stateIndex = sortedStates.indexOf(childState);
        
        if (themeIndex === -1 || stateIndex === -1) continue;
        
        // Position in grid: row = state, column = theme
        child.setGridChildPosition(stateIndex, themeIndex);
      }
      
      // Dashed stroke: yellow #FFFF00 if problems, else purple #8A38F5
      const strokeColor = hasAnyProblems 
        ? { r: 0xFF / 255, g: 0xFF / 255, b: 0x00 / 255 }
        : { r: 0x8A / 255, g: 0x38 / 255, b: 0xF5 / 255 };
      
      componentSet.strokes = [{
        type: 'SOLID',
        color: strokeColor
      }];
      componentSet.strokeWeight = 1;
      componentSet.strokeAlign = 'INSIDE';
      componentSet.dashPattern = [10, 5];
      
      // Position Component Set
      componentSet.x = position.x;
      componentSet.y = position.y;
      
      finalWidth = componentSet.width;
      finalHeight = componentSet.height;
      
      // Add to existing cache
      existingComponentNames.add(componentName);
      
      log(`Created Component Set: ${componentName} (${createdVariants.length} variants, ${sortedThemes.length} themes × ${sortedStates.length} states)`, 'success');
      
    } catch (err) {
      log(`Error creating Component Set: ${err.message} (${err.name})`, 'error');
      
      // Fallback: leave as separate components
      createdVariants.forEach((v, i) => {
        v.component.name = `${componentName} / ${v.component.name}`;
        v.component.x = position.x + i * (iconWidth + gap);
        v.component.y = position.y;
      });
      
      finalWidth = createdVariants.length * (iconWidth + gap);
      finalHeight = iconHeight;
    }
  }
  
  // Send dimensions back to UI
  figma.ui.postMessage({ 
    type: 'component-created', 
    width: finalWidth, 
    height: finalHeight 
  });
}
