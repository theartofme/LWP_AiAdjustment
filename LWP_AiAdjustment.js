//=============================================================================
// LWP_AiAdjustment.js
//=============================================================================

// TODO: MZ compatibility

/*:
 * @target MV
 * @plugindesc Allows finer control over the battle actions of enemies.
 * @author Logan Pickup
 * 
 * @help
 * Provides some notetags to allow changing the way the enemies select
 * skills to use and the targets to use them on. It does this by tweaking
 * the existing skill ratings in an enemy's action patterns, and allowing
 * custom tgr (target rating) based on conditions to control target
 * selection.
 * 
 * There is no separate list of skills with this plugin; it only modifies
 * the existing action pattern.
 * 
 * How To Use
 * 
 * Add the following to an enemy's "Note" section:
 * <skill-ai skill>
 * modifiers...
 * </skill-ai>
 * For skill, you can either put a skill ID, for example:
 * <skill-ai 12>
 * Or you can put the skill name, for example:
 * <skill-ai Fire I>
 * All the modifiers between <skill-ai> and </skill-ai> will
 * apply to this enemy's use of the skill.
 * 
 * There are two kinds of modifiers: changes to "rating", which
 * affects how often the skill is selected by the enemy, and changes
 * to "tgr", which affect how the enemy chooses targets for the
 * skill.
 * 
 * Rating (changing which skill is selected):
 * 
 * Changes to rating always follow this pattern:
 * boost/nerf amount when condition
 * Use boost if you want to increase the chance of using this
 * skill, nerf to decrease the chance. Amount is the amount to
 * change the rating; "boost 2" will increase the rating by 2
 * if its conditions happen, "nerf 5" will decrease the rating
 * by 5 if its conditions happen. Everything following the word
 * "when" is the condition; the boost or nerf doesn't do anything
 * unless this condition is true.
 * 
 * Conditions can either examine a battler, or a switch or variable.
 * If the condition contains "me", "ally", or "enemy", then it will
 * trigger if any battlers in the battle match the condition. For
 * example, "ally.hp below 50%" will trigger if any ally has hp
 * below 50%. Use "all" to specify that all battlers in that category
 * must match, not just any one. A "property selector" will usually
 * follow immediately, and can be any property of battlers; for example:
 * .hp
 * .mp
 * .atk
 * ...etc. Only hp and mp allow checking against percentages.
 * Additionally, the following special properties are supported:
 * .state
 * Instead of a battler, you can compare switches and variables,
 * e.g. "variable 2" or "switch 1".
 * 
 * The battler/switch/variable (the "subject") is then compared
 * to a value. These are the permitted comparisons:
 * zero: true if the subject is zero.
 * low: for hp/mp, true if below 33%. For other values, true if below 3.
 * high: for hp/mp, true if above 66%. For other values, true if above 5.
 * max: for hp/mp only, true if at maximum.
 * below/equal/above/not equal x: true based on comparing the subject to x.
 * "x" can be a plain number, a variable (e.g. "variable 3"), or a
 * percentage (for hp/mp only).
 * is/is not x: used when comparing states or switches. For states,
 * "x" is a state name or ID, and the condition is true if the
 * battler is currently affected by (or not affected by, for "is not")
 * the state. For switches, "x" is either "on" or "off".
 * is dead/is not dead: this is a special comparison is the only one
 * that can be used on a battler without selecting a property.
 * 
 * Some examples:
 * boost 3 when me.hp low
 * nerf 10 when all enemy.state is Poisoned
 * boost 10 when ally is dead
 * 
 * You can have as many boost/nerf lines as you like, to cover
 * multiple situations. Boost/nerf only affects which skill is
 * selected; it does not affect which target is selected.
 * 
 * These ratings combine with the ratings in the action patterns
 * box; so if you have a monster with the skill "Heal" and rating 5,
 * and a boost 6 and a nerf 4 both apply, the final rating will be
 * 5 + 6 - 4 = 7, which is then used as normal by RPG Maker.
 * 
 * TGR (changing which target is selected):
 * 
 * Changing valid targets always has the pattern:
 * target rate only condition
 * The word "target" must always appear.
 * Rate is optional; if not present, it defaults to "2x". This
 * is the amount that tgr is modified by if the condition is true.
 * It can be any number followed by "x" for "times"; e.g. if the
 * rate is "2.5x", then if the condition is true the TGR of the
 * target will be 2.5 times greater than normal. Generally speaking,
 * doubling TGR will double the chance that this target is chosen.
 * "only" is optional; if present, only targets matching the
 * condition are valid, no other targets will be available for
 * selection. If absent, targets matching the condition have their
 * TGR modified but other targets may still be selected following the
 * normal rules.
 * Only one of rate or "only" may be present.
 * 
 * The condition is the same as the condition for changing the skill
 * selection, except that the battler is always the target. Switches
 * and variables cannot be the subject of the condition here. Properties
 * can still be selected, for example the following:
 * target .hp low
 * doubles TGR for targets on low HP for this skill.
 * 
 * There are two special conditions for TGR: lowest and highest.
 * These two will select the lowest/highest from within the valid
 * targets, so for example given a skill with scope "1 enemy", if
 * you have:
 * target .hp lowest
 * Then if there are 3 enemies, one on 2hp, one on 5hp, and one
 * dead with 0hp, then only the enemy with 2hp will have its TGR
 * boosted.
 * The dead enemy will not, because "1 enemy" is only allowed to
 * target living battlers.
 * 
 * Longer example with comments:
 * <skill-ai 4> // affects only skill ID 4 for this enemy
 * boost 2 ally.hp max // we want to choose this more often if everyone on the team is at max health
 * nerf 5 all enemy.state is Protected // don't use this skill if the enemy is protected 
 * target 3x .hp low // go for the kill; prefer targetting low-hp enemies
 * </skill-ai>
 */

(function() {

	const oldDataManager_isDatabaseLoaded = DataManager.isDatabaseLoaded;
    DataManager.isDatabaseLoaded = function() {
		let loaded = oldDataManager_isDatabaseLoaded.call(this);
		if (loaded) {
			processEnemyNotetags($dataEnemies);
		}
		return loaded;
    };

	function findSkillByName(skillName) {
		let matchingSkills = $dataSkills.filter(
			skill => skill != null && skill.name.toLowerCase() === skillName.toLowerCase()
		);
		if (matchingSkills.length === 0) {
			throw new Error("Could not find skill " + skillName);
		}
		return matchingSkills[0].id;
	}

	function findStateByName(stateName) {
		let matchingStates = $dataStates.filter(
			state => state != null && state.name.toLowerCase() === stateName.toLowerCase()
		);
		return matchingStates[0].id;
	}

	function getEasySkillModifiers(note) {
		const easySkillModifiers = {};
		const notedata = note;
		const re = /<skill-ai\s+(?:(\d+)|([^>]+))\s*>(.*?)<\/skill-ai>/gms;
		let match = re.exec(notedata);
		while (match) {
			let skillId = (match[1] && parseInt(match[1])) || findSkillByName(match[2]);
			let script = match[3].split(/[\n\r]+/).filter(a => !/^\s*$/.test(a));
			if (easySkillModifiers[skillId]) {
				easySkillModifiers[skillId] = easySkillModifiers[skillId].concat(script);
			} else {
				easySkillModifiers[skillId] = script;
			}
			match = re.exec(notedata);
		}
		return easySkillModifiers;
	}

    function processEnemyNotetags(enemies) {
        for (var i = 1; i < enemies.length; i++) {
            var enemy = enemies[i];
            if (enemy.note) {
				enemy.easySkillModifiers = getEasySkillModifiers(enemy.note);
            }
        };
	}

	function easyModifierActorPropertyProcessor(prop) {
		return (actor) => {
			if (!prop || /^\s*$/.test(prop)) return [actor, undefined];
			switch (prop) {
				case 'hp': return [actor.hp, actor.mhp];
				case 'mp': return [actor.mp, actor.mmp];
				case 'state': return [actor.states().map(s => s.id), undefined];
				default: return [actor[prop], undefined];
			}
		}
	}

	function easyModifiersLhs(self, expression) {
		const actorExpression = /\s*(?:(all)\s+)?(ally|enemy|me)(?:\.(hp|mp|state|[a-zA-Z]+))(?:\s+(.*))?/;
		let evaluator;
		let rhs;
		let actorMatch = actorExpression.exec(expression);
		if (actorMatch) {
			let all = /all/i.test(actorMatch[1]);
			let actorType = actorMatch[2];
			let actorProperty = actorMatch[3];
			let propertyAccessor = easyModifierActorPropertyProcessor(actorProperty);
			rhs = actorMatch[4];
			evaluator = (rhsEvaluator) => {
				let actors = [];
				if (/^my|me$/i.test(actorType)) {
					actors = [self];
				} else if (/ally/i.test(actorType)) {
					actors = self.friendsUnit().members();
				} else {
					actors = self.opponentsUnit().members();
				}
				let [min, max] = actors.reduce((incoming, actor) => {
					let props = propertyAccessor(actor);
					let min = incoming[0] === null ? props[0] : Math.min(props[0], incoming[0]);
					let max = incoming[0] === null ? props[0] : Math.max(props[0], incoming[0]);
					return [min, max];
				}, [null, null]);
				if (all) {
					return actors.every(actor => {
						let [value, maxValue] = propertyAccessor(actor);
						return rhsEvaluator(value, maxValue, min, max);
					});
				} else {
					return actors.some(actor => {
						let [value, maxValue] = propertyAccessor(actor);
						return rhsEvaluator(value, maxValue, min, max);
					});
				}
			}
		}
		const switchExpression = /switch\s+(\d+)\s+(.*)/;
		let switchMatch = switchExpression.exec(expression);
		if (switchMatch) {
			let switchId = parseInt(switchMatch[1]);
			rhs = switchMatch[2];
			evaluator = (rhsEvaluator) => {
				let value = $gameSwitches.value(switchId);
				return rhsEvaluator(value);
			}
		}
		const variableExpression = /variable\s+(\d+)\s+(.*)/;
		let variableMatch = variableExpression.exec(expression);
		if (variableMatch) {
			let variableId = parseInt(variableMatch[1]);
			rhs = variableMatch[2];
			evaluator = (rhsEvaluator) => {
				let value = $gameVariables.value(variableId);
			}
			return rhsEvaluator(value);
		}

		return {evaluator, rhs};
	}

	function easyModifiersRhs(rhs) {
		if (!rhs || rhs.replace(/^\s+|\s+$/g, '') === '') {
			return (value) => {
				return !!value;
			};
		}
		const rhsExpression = /^\s*(zero|lowest|highest|low|high|max)|(below|equals?|not equals?|above)\s+(?:(\d+)|(\d+)%|variable\s+(\d+))\s*$/;
		let rhsMatch = rhsExpression.exec(rhs);
		if (rhsMatch) {
			let namedCategory = rhsMatch[1]; // only valid if a valid MAX value is also available, eg. hp/mhp
			if (namedCategory) {
				return (value, valueMax, groupMin, groupMax) => {
					switch (namedCategory) {
						case 'zero': return value === 0;
						case 'low': return valueMax ? value < valueMax / 3 : value < 3;
						case 'high': return valueMax ? value > 2 * valueMax / 3 : value > 5;
						case 'max': return value === valueMax;
						case 'lowest': return value === groupMin;
						case 'highest': return value === groupMax;
					}
				}
			}
			let inequality = rhsMatch[2].toLowerCase().replace(/s$/,'');
			let comparator;
			switch (inequality) {
				case 'below': comparator = (a, b) => a < b; break;
				case 'equal': comparator = (a, b) => a == b; break;
				case 'not equal': comparator = (a, b) => a != b; break;
				case 'above': comparator = (a, b) => a > b; break;
			}
			let constantNumber = rhsMatch[3];
			if (constantNumber) {
				const parsedNumber = parseInt(constantNumber);
				return (value) => {
					return comparator(value, parsedNumber);
				}
			}
			let percentage = rhsMatch[4]; // only valid if a valid MAX value is also available, eg. hp/mhp
			if (percentage) {
				const parsedPercentage = parseInt(percentage) / 100;
				return (value, valueMax) => {
					return comparator(value / valueMax, parsedPercentage);
				}
			}
			let variableId = rhsMatch[5];
			if (variableId) {
				return (value) => {
					let variableValue = $gameVariables.value(parseInt(variableId));
					return comparator(value, variableValue);
				}
			}
		}
		const rhsSetExpression = /^\s*is(\s+not)?\s+(?:(\d+)|(on|off)|(.*))\s*$/;
		let rhsSetMatch = rhsSetExpression.exec(rhs);
		if (rhsSetMatch) {
			let not = /not/i.test(rhsSetMatch[1]);
			let stateId = rhsSetMatch[2];
			if (stateId) {
				return (values) => {
					if (!values.includes) return (values === parseInt(stateId)) !== not
					return values.includes(parseInt(stateId)) !== not;
				};
			}
			let stateName = rhsSetMatch[4];
			if (stateName) {
				if (/^dead$/i.test(stateName)) {
					return (actor) => {
						return actor.isDeathStateAffected();
					}
				}
				let stateId = findStateByName(stateName);
				return (values) => {
					if (!values.includes) return (values === stateId) !== not
					return values.includes(stateId) !== not;
				};
			}
			let boolean = /on/i.test(rhsSetMatch[3]);
			return (value) => {
				return (value === boolean) !== not;
			};
		}
		console.log("Could not parse RHS expression", rhs);
		throw new Error("Could not parse RHS expression");
	}

	Game_Enemy.prototype.execEasyModifiersForRating = function(rating, easyModifiers) {
		for (line of easyModifiers) {
			const ratingRe = /(boost|nerf)\s+(\d+)\s+when\s+(.*)/i
			let match = ratingRe.exec(line);
			if (match) {
				let type = match[1];
				let amount = parseInt(match[2]);
				if (/nerf/.test(type)) {
					amount = -amount;
				}
				let whenClause = match[3];
				let {evaluator, rhs} = easyModifiersLhs(this, whenClause);
				let result = evaluator(easyModifiersRhs(rhs));
				if (result) {
					rating = rating + amount;
				}
			}
		}
		return rating;
	}

	Game_Enemy.prototype.execEasyModifiersForTgr = function(easyModifiers, availableTargets) {
		let tgrs = availableTargets.map(target => target.tgr);
		for (line of easyModifiers) {
			const targetRe = /target\s+(?:(\d*\.?\d+)x\s+|(only)\s+)?(?:\.([a-zA-Z]+)\s+)?(.*)/i
			let match = targetRe.exec(line);
			if (match) {
				let multiplier = match[1];
				let only = !!match[2];
				let prop = match[3];
				let propertyAccessor = easyModifierActorPropertyProcessor(prop);
				let rhs = match[4];

				evaluator = (targets, tgrs, rhsEvaluator) => {
					let actors = targets;
					let [min, max] = actors.reduce((incoming, actor, i) => {
						let props = propertyAccessor(actor, {tgr: tgrs[i]});
						let min = incoming[0] === null ? props[0] : Math.min(props[0], incoming[0]);
						let max = incoming[0] === null ? props[0] : Math.max(props[0], incoming[0]);
						return [min, max];
					}, [null, null]);
					for (let i in targets) {
						let actor = targets[i];
						let [value, maxValue] = propertyAccessor(actor, {tgr: tgrs[i]});
						let result = rhsEvaluator(value, maxValue, min, max);
						console.log("Result for target condition " + line + " for target: " + result, actor, {value, maxValue, min, max});
						if (result) {
							if (!only) {
								multiplier = multiplier || "2";
								tgrs[i] *= parseFloat(multiplier);
							}
						} else if (only) {
							tgrs[i] = 0;
						}
					}
				}
				evaluator(availableTargets, tgrs, easyModifiersRhs(rhs));
			}
		}
		return tgrs.map((tgr, i) => ({member: availableTargets[i], tgr}));
	}

	Game_Enemy.prototype.modifyActionRating = function(action) {
		let skillId = action.skillId;
		let rating = action.rating;
		if (this.enemy().easySkillModifiers && this.enemy().easySkillModifiers[skillId]) {
			easyModifiers = this.enemy().easySkillModifiers[skillId];
			rating = this.execEasyModifiersForRating(action.rating, easyModifiers);
		}
		return rating;
	}
	
	const oldGame_Enemy_selectAllActions = Game_Enemy.prototype.selectAllActions;
	Game_Enemy.prototype.selectAllActions = function(actionList) {
		const modifiedRatingList = actionList.map( action => {
			return Object.assign({}, action, {rating: this.modifyActionRating(action)});
		});
		console.log("Modified action list for " + this.name(), modifiedRatingList);
		return oldGame_Enemy_selectAllActions.call(this, actionList);
	};

	const oldGame_Action_targetsForOpponents = Game_Action.prototype.targetsForOpponents;
	Game_Action.prototype.targetsForOpponents = function() {
		var targets = [];
		if (this.isForRandom()) {
			for (var i = 0; i < this.numTargets(); i++) {
				targets.push(this.opponentsUnit().randomTarget(this.makeTgrModifier()));
			}
			return targets;
		} else if (this.isForOne() && this._targetIndex < 0) {
			targets.push(this.opponentsUnit().randomTarget(this.makeTgrModifier()));
			return targets;
		}
		return oldGame_Action_targetsForOpponents.call(this);
	};
	
	const oldGame_Action_targetsForFriends = Game_Action.prototype.targetsForFriends
	Game_Action.prototype.targetsForFriends = function() {
		if (this.isForOne() && !this.isForDeadFriend() &&
			!this.isForUser()) {
			return [this.friendsUnit().randomTarget(this.makeTgrModifier())];
		}
		return oldGame_Action_targetsForFriends.call(this);
	};

	Game_Action.prototype.makeTgrModifier = function() {
		if (!this.isSkill()) return undefined;
		let skill = this.item();
		if (this.subject().friendsUnit() !== $gameTroop) {
			return undefined;
		}
		let gameEnemy = this.subject();
		if (!gameEnemy.enemy().easySkillModifiers) return undefined;
		let skillModifiers = gameEnemy.enemy().easySkillModifiers[skill.id];
		if (!skillModifiers) return undefined;
		return (availableTargets) => {
			return gameEnemy.execEasyModifiersForTgr(
				skillModifiers, availableTargets);
		}
	}

	const oldGame_Action_decideRandomTarget = Game_Action.prototype.decideRandomTarget
	Game_Action.prototype.decideRandomTarget = function() {
		var target;
		if (this.isForFriend()) {
			target = this.friendsUnit().randomTarget(this.makeTgrModifier());
		} else if (!this.isForDeadFriend()) {
			target = this.opponentsUnit().randomTarget(this.makeTgrModifier());
		}
		if (target) {
			this._targetIndex = target.index();
		} else {
			oldGame_Action_decideRandomTarget.call(this);
		}
	};

	const oldGame_Unit_randomTarget = Game_Unit.prototype.randomTarget;
	Game_Unit.prototype.randomTarget = function(tgrModifier) {
		if (tgrModifier) {
			let membersWithModifiers = tgrModifier(this.aliveMembers());
			console.log("Choosing at random with modified weights", membersWithModifiers);
			let tgrSum = membersWithModifiers.reduce(function(r, m) {
				return r + m.tgr;
			}, 0);
			let tgrRand = Math.random() * tgrSum;
			let target = null;
			membersWithModifiers.forEach(function(m) {
				tgrRand -= m.tgr;
				if (tgrRand <= 0 && !target) {
					target = m.member;
				}
			});
			return target;
		} else {
			return oldGame_Unit_randomTarget.call(this);
		}
	};

	//////////////////////////////////////////////////////////////
	// TESTS
	//////////////////////////////////////////////////////////////

	function easyModifiersRhsTest() {
		function test(rhsString, comparisonValue, maxValue, expected) {
			let result = easyModifiersRhs(rhsString)(comparisonValue, maxValue);
			if (result !== expected) {
				let formattedValue = maxValue ? (comparisonValue + " out of " + maxValue) : comparisonValue.toString();
				console.log("Test failed! [" + formattedValue + " " + rhsString + "] should be " + expected);
			}
		}
		test("below 2", 1, undefined, true);
		test("below 2", 2, undefined, false);
		test("above 1", 2, undefined, true);
		test("above 1", 1, undefined, false);
		test("equal 1", 1, undefined, true);
		test("equal 1", 2, undefined, false);
		test("not equal 2", 1, undefined, true);
		test("not equal 2", 2, undefined, false);
		$gameVariables = {
			value: function(x) { return x; }
		}
		test("equal variable 2", 2, undefined, true);
		test("below 20%", 1, 6, true);
		test("below 20%", 1, 5, false);
		test("low", 1, 5, true);
		test("low", 4, 5, false);
		test("high", 4, 5, true);
		test("high", 1, 5, false);
		test("max", 5, 5, true);
		test("max", 4, 5, false);
		test("zero", 0, undefined, true);
		test("is 1", 1, undefined, true);
		test("is 1", 2, undefined, false);
		test("is not 1", 2, undefined, true);
		test("is not 1", 1, undefined, false);
		test("is 1", [0, 1, 2], undefined, true);
		test("is 1", [2, 3], undefined, false);
		test("is not 1", [2, 3], undefined, true);
		test("is not 1", [0, 1, 2], undefined, false);
		test("is on", true, undefined, true);
		test("is on", false, undefined, false);
		test("is off", false, undefined, true);
		test("is off", true, undefined, false);
		test("is not on", false, undefined, true);
		test("is not on", true, undefined, false);
		test("is not off", true, undefined, true);
		test("is not off", false, undefined, false);
		$dataStates = [null, {id: 1, name: "test state"}];
		test("is test state", [0, 1, 2], undefined, true);
		test("is test state", [2, 3], undefined, false);
		test("is not test state", [2, 3], undefined, true);
		test("is not test state", [0, 1, 2], undefined, false);
	}

	easyModifiersRhsTest();

	function easyModifiersLhsTest() {
		function test(rhsString, comparisonValue, maxValue, expected) {
			let result = easyModifiersRhs(rhsString)(comparisonValue, maxValue);
			if (result !== expected) {
				let formattedValue = maxValue ? (comparisonValue + " out of " + maxValue) : comparisonValue.toString();
				console.log("Test failed! [" + formattedValue + " " + rhsString + "] should be " + expected);
			}
		}
		let self = {
			hp: 5,
			mhp: 8,
			charge: 1,
			opponentsUnit: function() {
				return {members: function() {
					return [{hp: 2, mhp: 2, charge: 0}, {hp: 12, mhp: 20, charge: 3}];
				}}
			},
			friendsUnit: function() {
				return {members: function() {
					return [{hp: 1, mhp: 2, charge: 1}, {hp: 10, mhp: 12, charge: 0}];
				}}
			},
		};

		function testCall(expression, valueSelector, expectedArray) {
			let {evaluator, rhs} = easyModifiersLhs(self, expression);
			let calls = [];
			evaluator((value, valueMax, min, max) => {
				calls.push({value, valueMax, min, max});
				return false; // forces all in sequence to be called
			});
			let result = calls.map(call => call[valueSelector]);
			if (JSON.stringify(result) !== JSON.stringify(expectedArray)) {
				console.log("Call sequence of " + valueSelector + " for [" + expression + "] should be " + expectedArray + " but was " + result);
			}
		}

		testCall("ally.hp low", "value", [1, 10]);
		testCall("ally.hp low", "valueMax", [2, 12]);
		testCall("ally.hp low", "min", [1, 1]);
		testCall("ally.hp low", "max", [10, 10]);

		testCall("me.hp low", "value", [5]);
		testCall("me.hp low", "valueMax", [8]);
		testCall("me.hp low", "min", [5]);
		testCall("me.hp low", "max", [5]);

		testCall("enemy.charge low", "value", [0, 3]);
		testCall("enemy.charge low", "valueMax", [undefined, undefined]);
		testCall("enemy.charge low", "min", [0, 0]);
		testCall("enemy.charge low", "max", [3, 3]);

		function integrationTest(expression, expectedResult) {
			let {evaluator, rhs} = easyModifiersLhs(self, expression);
			let result = evaluator(easyModifiersRhs(rhs));
			if (result !== expectedResult) {
				console.log("Test failed: [" + expression + "] should be " + expectedResult + ", was " + result);
			}
		}
		integrationTest("enemy.hp low", false);
		integrationTest("enemy.hp high", true);
		integrationTest("all enemy.hp high", false);
		integrationTest("me.charge", true);
	}
	easyModifiersLhsTest();

})();
