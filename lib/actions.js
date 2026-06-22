import { analyseTabs } from './analyze.js';
import { removeDuplicates, closeErrorTabs, closeSearchDuplicates, closeYoutubeDuplicates, closeDiscardedTabs, closeTransientTabs, closeOrphanedTabs, closeStuckTabs, runAllCleanups } from './cleanup.js';
import { groupByDomain, groupDomainOf } from './grouping.js';
import { undoLast, getUndoHistory } from './undo.js';
import {
  analyseTabAge, findStaleTabs, closeStaleTabs,
  saveAndCloseStaleTabs, getSavedTabs, reopenSavedTab, removeSavedTab, clearSavedTabs,
  closeGroup, listGroups, focusMode,
} from './stale.js';
import { getSmartSuggestions, closeSmartSuggestions } from './aicleanup.js';
import { getAiClusters, applyAiClusters } from './aigrouping.js';

export async function dispatch(message) {
  switch (message.action) {
    // Analysis
    case 'getAnalysis':               return analyseTabs();
    case 'getTabAge':                 return analyseTabAge();
    case 'getStaleTabs':              return findStaleTabs();
    case 'listGroups':                return listGroups();
    case 'getSavedTabs':              return getSavedTabs();

    // Cleanup
    case 'removeDuplicates':          return removeDuplicates();
    case 'closeErrorTabs':            return closeErrorTabs();
    case 'closeSearchDuplicates':     return closeSearchDuplicates();
    case 'closeYoutubeDuplicates':    return closeYoutubeDuplicates();
    case 'closeDiscardedTabs':        return closeDiscardedTabs();
    case 'closeTransientTabs':        return closeTransientTabs();
    case 'closeOrphanedTabs':         return closeOrphanedTabs();
    case 'closeStuckTabs':            return closeStuckTabs();
    case 'closeStaleTabs':            return closeStaleTabs();
    case 'saveAndClose':              return saveAndCloseStaleTabs();
    case 'closeGroup':                return closeGroup(message.groupId);
    case 'focusMode':                 return focusMode();
    case 'runAll':                    return runAllCleanups();

    // Grouping
    case 'groupByDomain':             return groupByDomain();
    case 'groupDomainOf':             return groupDomainOf(message.tabId);

    // Saved tabs queue
    case 'reopenSavedTab':            return reopenSavedTab(message.url);
    case 'removeSavedTab':            return removeSavedTab(message.url);
    case 'clearSavedTabs':            return clearSavedTabs();

    // Undo / history
    case 'undoLast':                  return undoLast();
    case 'getUndoHistory':            return getUndoHistory();

    // AI smart suggestions
    case 'getSmartSuggestions':       return getSmartSuggestions(message.aiConfig);
    case 'closeSmartSuggestions':     return closeSmartSuggestions(message.tabIds);

    // AI clustering
    case 'getAiClusters':             return getAiClusters(message.aiConfig);
    case 'applyAiClusters':           return applyAiClusters(message.clusters);

    default:
      return { success: false, error: `Unknown action: ${message.action}` };
  }
}
