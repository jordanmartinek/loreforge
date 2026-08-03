/// Generic single-parent-tree cycle detection, shared by every entity type
/// whose hierarchy is a strict tree (a node has at most one parent):
/// Locations (Phase 4), Species (Phase 6), Military (Phase 7), and now
/// Religions (Phase 9).
///
/// Extracted here because the exact same algorithm had been independently
/// (re)written three times (`locations::would_create_cycle`,
/// `species::would_create_cycle`, `military::would_create_cycle`), each
/// differing only in which table/column the caller reads a node's parent
/// from. Phase 7's design doc explicitly deferred this extraction,
/// reasoning two examples weren't enough to design a generic shape
/// against; by the third example, there was no meaningful variation left
/// to discover, so this module is a straight lift of the existing
/// chain-walk with a closure parameter for "how do I look up a given
/// node's current parent id" -- see design-phase-9-religions.md section 1
/// for the full reasoning, including why this does NOT also try to unify
/// Phase 5's graph-cycle-detection or Phase 8's symmetric-edge validation
/// (both solve genuinely different problems).
///
/// This function is intentionally free of any database or entity-type
/// awareness: it operates purely on `&str` ids and a caller-supplied
/// lookup function, which is what makes it trivially shared across four
/// otherwise-unrelated Rust modules without introducing a dependency
/// between them.
pub fn would_create_cycle<F>(candidate_id: &str, new_parent_id: &str, mut get_parent_id: F) -> bool
where
    F: FnMut(&str) -> Option<String>,
{
    if candidate_id == new_parent_id {
        return true;
    }

    let mut seen = std::collections::HashSet::new();
    let mut current = Some(new_parent_id.to_string());

    while let Some(id) = current {
        if id == candidate_id {
            return true;
        }
        if !seen.insert(id.clone()) {
            break; // pre-existing cycle elsewhere; don't loop forever
        }
        current = get_parent_id(&id);
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    /// A tiny in-memory parent map, standing in for what each real caller
    /// does via `get(conn, id)?.parent_*_id` -- lets these tests exercise
    /// every reachable branch of the algorithm without touching SQLite,
    /// which is exactly the "trivially testable in isolation" property
    /// design-phase-9-religions.md section 1.1 calls out (even though, per
    /// NFR3, this phase relies on the four callers' own test suites as the
    /// actual correctness proof rather than duplicating coverage here).
    fn lookup<'a>(tree: &'a HashMap<&'a str, &'a str>) -> impl FnMut(&str) -> Option<String> + 'a {
        move |id: &str| tree.get(id).map(|s| s.to_string())
    }

    #[test]
    fn a_node_cannot_become_its_own_parent() {
        assert!(would_create_cycle("a", "a", lookup(&HashMap::new())));
    }

    #[test]
    fn a_node_cannot_become_a_child_of_its_own_direct_child() {
        // a -> b (b's parent is a)
        let tree: HashMap<&str, &str> = HashMap::from([("b", "a")]);
        // Moving "a" under "b" would make a its own grandchild.
        assert!(would_create_cycle("a", "b", lookup(&tree)));
    }

    #[test]
    fn a_node_cannot_become_a_child_of_a_deep_descendant() {
        // a -> b -> c -> d (chain of parents)
        let tree: HashMap<&str, &str> = HashMap::from([("b", "a"), ("c", "b"), ("d", "c")]);
        assert!(would_create_cycle("a", "d", lookup(&tree)));
    }

    #[test]
    fn unrelated_nodes_do_not_create_a_cycle() {
        let tree: HashMap<&str, &str> = HashMap::from([("b", "a")]);
        assert!(!would_create_cycle("c", "a", lookup(&tree)));
        assert!(!would_create_cycle("c", "b", lookup(&tree)));
    }

    #[test]
    fn a_pre_existing_cycle_elsewhere_in_the_data_does_not_loop_forever() {
        // Deliberately malformed input (shouldn't occur given the write-side
        // guards, but the walk must still terminate defensively): x -> y -> x.
        let tree: HashMap<&str, &str> = HashMap::from([("x", "y"), ("y", "x")]);
        // Should terminate rather than hang, regardless of the boolean result.
        let _ = would_create_cycle("z", "x", lookup(&tree));
    }
}
